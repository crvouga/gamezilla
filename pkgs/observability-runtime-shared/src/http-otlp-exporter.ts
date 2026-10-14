import type { ISerializer } from '@opentelemetry/otlp-transformer';
import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { acknowledgementBytes } from './otlp-acknowledgement';

type Outcome = { readonly code: 0 | 1; readonly error?: Error };

/** Injected Worker transport; SDK fetch transport leaves acknowledgements unread. */
export class HttpOtlpExporter<T, R> {
  readonly #pending = new Set<Promise<void>>();
  #failure: Error | undefined;
  #closed = false;

  constructor(
    private readonly config: {
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly serializer: ISerializer<T, R>;
      readonly rejected: (response: R) => number;
    },
    private readonly http: HttpClient,
    private readonly timers: Timers
  ) {}

  export(payload: T, callback: (outcome: Outcome) => void): void {
    if (this.#closed) {
      callback({ code: 1, error: new Error('OTLP exporter is closed') });
      return;
    }
    const operation = this.send(payload).then(
      () => callback({ code: 0 }),
      (cause: unknown) => {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        this.#failure ??= error;
        callback({ code: 1, error });
      }
    );
    this.#pending.add(operation);
    void operation.then(
      () => this.#pending.delete(operation),
      () => this.#pending.delete(operation)
    );
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.#pending);
    const error = this.#failure;
    this.#failure = undefined;
    if (error !== undefined) throw error;
  }

  async shutdown(): Promise<void> {
    this.#closed = true;
    await this.forceFlush();
  }

  private async send(payload: T): Promise<void> {
    const abort = new AbortController();
    let timer: unknown;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = this.timers.setTimeout(() => {
        abort.abort();
        reject(new Error('OTLP acknowledgement timed out'));
      }, 5000);
    });
    try {
      await Promise.race([this.request(payload, abort.signal), deadline]);
    } finally {
      this.timers.clearTimeout(timer);
    }
  }

  private async request(payload: T, signal: AbortSignal): Promise<void> {
    const body = this.config.serializer.serializeRequest(payload);
    if (body === undefined) throw new Error('OTLP serialization failed');
    const response = await this.http.fetch(this.config.url, {
      method: 'POST',
      headers: { ...this.config.headers, 'content-type': 'application/json' },
      body: body.slice().buffer,
      signal,
    });
    if (!response.ok || signal.aborted) {
      await response.body?.cancel();
      throw new Error(`OTLP export rejected (${response.status})`);
    }
    const bytes = await acknowledgementBytes(response, signal);
    if (bytes.byteLength === 0) return;
    const document: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      document === null ||
      typeof document !== 'object' ||
      Array.isArray(document)
    )
      throw new Error('Invalid OTLP acknowledgement');
    const rejected = this.config.rejected(
      this.config.serializer.deserializeResponse(bytes)
    );
    if (!Number.isSafeInteger(rejected) || rejected !== 0)
      throw new Error('OTLP records rejected');
  }
}
