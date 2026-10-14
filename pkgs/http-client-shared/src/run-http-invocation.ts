import type { createScopedHttpClient } from './scoped-http-client';

/** Join waitUntil work before checking body ownership; no rejection is hidden. */
export function runHttpInvocation<T>(
  http: ReturnType<typeof createScopedHttpClient>,
  invoke: (waitUntil: (promise: Promise<unknown>) => void) => Promise<T>
): Promise<T> {
  return http.run(async () => {
    const pending: Promise<unknown>[] = [];
    const waitUntil = (promise: Promise<unknown>) => {
      pending.push(promise);
      // Mark handled immediately; the join below reports its failure.
      void promise.catch(() => undefined);
    };
    try {
      return await invoke(waitUntil);
    } finally {
      for (let cursor = 0; cursor < pending.length; ) {
        const batch = pending.slice(cursor);
        cursor = pending.length;
        const results = await Promise.allSettled(batch);
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      }
    }
  });
}
