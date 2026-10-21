import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import { requestMethod, requestPath } from './http-request';

type Outcome = 'hold' | 'fail';
type Pending = { readonly finish: (failed: boolean) => void };

/** Script unfinished and failed requests at the injected HTTP boundary. */
export function createHttpRequestControls() {
  const rules = new Map<string, Outcome>();
  const rewrites = new Map<string, (request: Request) => Promise<Request>>();
  const pending = new Map<string, Set<Pending>>();
  const key = (actor: string, method: string, path: string) =>
    `${actor}:${method}:${path}`;
  const failure = () =>
    new Response('Temporarily unavailable', { status: 503 });
  return {
    rewrite(
      actor: string,
      method: string,
      path: string,
      transform: ((request: Request) => Promise<Request>) | null
    ) {
      const id = key(actor, method, path);
      if (transform === null) rewrites.delete(id);
      else rewrites.set(id, transform);
    },
    set(actor: string, method: string, path: string, outcome: Outcome | null) {
      const id = key(actor, method, path);
      if (outcome === null) rules.delete(id);
      else rules.set(id, outcome);
      if (outcome === 'hold') return;
      const held = pending.get(id);
      pending.delete(id);
      for (const item of held ?? []) item.finish(outcome === 'fail');
    },
    wrap(actor: string, inner: ServerHttp): ServerHttp {
      return (input, init) => {
        const id = key(actor, requestMethod(input, init), requestPath(input));
        const send = () => {
          const rewrite = rewrites.get(id);
          return rewrite === undefined
            ? inner(input, init)
            : rewrite(new Request(input, init)).then((request) =>
                inner(request)
              );
        };
        const outcome = rules.get(id);
        if (outcome === 'fail') return Promise.resolve(failure());
        if (outcome !== 'hold') return send();
        return new Promise<Response>((resolve, reject) => {
          const signal =
            init?.signal ?? (input instanceof Request ? input.signal : null);
          const held = pending.get(id) ?? new Set<Pending>();
          const cleanup = () => {
            held.delete(item);
            signal?.removeEventListener('abort', abort);
          };
          const item: Pending = {
            finish: (failed) => {
              cleanup();
              if (failed) resolve(failure());
              else void send().then(resolve, reject);
            },
          };
          const abort = () => {
            cleanup();
            reject(new DOMException('Request aborted', 'AbortError'));
          };
          if (signal?.aborted) {
            abort();
            return;
          }
          signal?.addEventListener('abort', abort, { once: true });
          held.add(item);
          pending.set(id, held);
        });
      };
    },
  };
}

export type HttpRequestControls = ReturnType<typeof createHttpRequestControls>;
