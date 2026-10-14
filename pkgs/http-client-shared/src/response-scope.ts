import type { HttpClient } from './types';

type PendingBody = {
  readonly label: string;
  readonly cancel: () => Promise<void>;
};

/** A request owns each outbound body until EOF, cancellation or forwarding. */
export class HttpResponseScope implements HttpClient {
  readonly #bodies = new Map<ReadableStream<Uint8Array>, PendingBody>();
  #requests = 0;
  #closed = false;

  constructor(private readonly inner: HttpClient) {}

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (this.#closed) throw new Error('HTTP request started after scope ended');
    this.#requests++;
    try {
      const response = await this.inner.fetch(input, init);
      if (this.#closed) {
        await response.body?.cancel();
        throw new Error('HTTP response arrived after scope ended');
      }
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method =
        init?.method ?? (input instanceof Request ? input.method : 'GET');
      return this.track(response, `${method} ${url.origin}${url.pathname}`);
    } finally {
      this.#requests--;
    }
  }

  private track(response: Response, label: string): Response {
    const source = response.body;
    if (source === null) return response;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = async () => {
      try {
        if (reader === undefined) await source.cancel();
        else await reader.cancel();
      } finally {
        this.#bodies.delete(body);
      }
    };
    const body = new ReadableStream<Uint8Array>(
      {
        pull: async (controller) => {
          reader ??= source.getReader();
          try {
            const next = await reader.read();
            if (next.done) {
              this.#bodies.delete(body);
              reader.releaseLock();
              controller.close();
            } else controller.enqueue(next.value);
          } catch (error) {
            this.#bodies.delete(body);
            reader.releaseLock();
            controller.error(error);
          }
        },
        cancel,
      },
      { highWaterMark: 0 }
    );
    this.#bodies.set(body, { label, cancel });
    let consuming = new Response(body, response);
    return new Proxy(response, {
      get: (target, key) => {
        if (key === 'clone')
          return () => {
            const cloned = consuming.clone();
            this.#bodies.delete(body);
            if (consuming.body !== null) this.#bodies.delete(consuming.body);
            if (cloned.body !== null) this.#bodies.delete(cloned.body);
            consuming = this.track(consuming, label);
            return this.track(cloned, label);
          };
        const owner =
          key in consuming &&
          [
            'body',
            'bodyUsed',
            'arrayBuffer',
            'blob',
            'bytes',
            'formData',
            'json',
            'text',
          ].includes(String(key))
            ? consuming
            : target;
        const value = Reflect.get(owner, key, owner);
        return typeof value === 'function' ? value.bind(owner) : value;
      },
    });
  }

  /** Fail even below the platform connection limit; clean up after reporting. */
  async finish(forwarded?: Response): Promise<void> {
    this.#closed = true;
    if (forwarded?.body !== null && forwarded?.body !== undefined)
      this.#bodies.delete(forwarded.body);
    const leaked = [...this.#bodies.values()];
    if (leaked.length === 0 && this.#requests === 0) return;
    // Tee cancellation can wait for a forwarded sibling. Reporting must not
    // wait for that consumer (it cannot start until this invocation returns).
    void Promise.allSettled(leaked.map((entry) => entry.cancel()));
    throw new Error(
      `HTTP response body leak: ${leaked.map((entry) => entry.label).join(', ')}; ${this.#requests} unfinished requests. Read every body to EOF or cancel it.`
    );
  }
}
