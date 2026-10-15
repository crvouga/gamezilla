import type { Timers } from '@pkgs/clock-shared/types';
import { trackAbortableResponse } from './abortable-response';
import { HttpAbortError } from './http-abort-error';
import { HttpNetworkError } from './http-network-error';
import type { HttpFetch } from './types';

/** Bounds the observation of a request, including its response body. */
export function createDeadlineFetch(args: {
  readonly fetch: HttpFetch;
  readonly timers: Timers;
  readonly timeoutMs?: number;
  readonly onTimeout?: (input: RequestInfo | URL) => void;
}): HttpFetch {
  const timeoutMs = args.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('HTTP deadline must be finite and positive');
  }
  return (input, init) => {
    const caller =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    if (caller?.aborted) return Promise.reject(new HttpAbortError());
    const controller = new AbortController();
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      args.timers.clearTimeout(timer);
      caller?.removeEventListener('abort', abort);
    };
    const abort = (): void => controller.abort(new HttpAbortError());
    const timer = args.timers.setTimeout(() => {
      controller.abort(
        new HttpNetworkError('The service did not answer in time.')
      );
      args.onTimeout?.(input);
    }, timeoutMs);
    caller?.addEventListener('abort', abort, { once: true });
    return observeRequest(args.fetch, input, init, {
      signal: controller.signal,
      release,
    });
  };
}

function observeRequest(
  inner: HttpFetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  observation: { readonly signal: AbortSignal; readonly release: () => void }
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const { signal, release } = observation;
    const abort = (): void => {
      signal.removeEventListener('abort', abort);
      release();
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    let request: Promise<Response>;
    try {
      request = inner(input, { ...init, signal });
    } catch (error) {
      signal.removeEventListener('abort', abort);
      release();
      reject(error);
      return;
    }
    void request.then(
      (response) => {
        signal.removeEventListener('abort', abort);
        if (signal.aborted) {
          void response.body?.cancel().catch(() => undefined);
          return;
        }
        try {
          resolve(trackAbortableResponse(response, signal, release));
        } catch (error) {
          release();
          reject(error);
        }
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        release();
        reject(signal.aborted ? signal.reason : error);
      }
    );
  });
}
