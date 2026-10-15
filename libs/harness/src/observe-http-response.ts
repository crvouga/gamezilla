import { HttpAbortError } from '@pkgs/http-client-shared/http-abort-error';

/** Cancelling the caller's observation does not revoke work admitted by the server. */
export function observeHttpResponse(
  work: Promise<Response>,
  signal: AbortSignal
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let cancelled = false;
    const abort = () => {
      cancelled = true;
      signal.removeEventListener('abort', abort);
      reject(new HttpAbortError());
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    work.then(
      async (response) => {
        signal.removeEventListener('abort', abort);
        if (cancelled) {
          await response.body?.cancel().catch(() => undefined);
          return;
        }
        resolve(response);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
