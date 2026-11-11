import type { Timers } from '@pkgs/clock-shared-ts/types';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { SyncHttpServerError } from './sync-http-server-error';

/** A failure a later attempt of the same read can get past. */
function transient(error: unknown): boolean {
  if (error instanceof HttpNetworkError) return true;
  if (error instanceof SyncHttpServerError) return true;
  // Errors that crossed a realm or a worker keep only their name.
  return (
    error instanceof Error &&
    (error.name === 'HttpNetworkError' || error.name === 'SyncHttpServerError')
  );
}

/**
 * Retry a read the network or the server failed; a successful full sweep
 * leaves no background polling.
 */
export function createQueryNetworkRetry(timers: Timers, wake: () => void) {
  let timer: unknown = null;
  let failures = 0;
  const reset = (): void => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    failures = 0;
  };
  return {
    reset,
    failed: (error: unknown): void => {
      // regression: query-server-error-waits-for-reconcile
      if (!transient(error) || timer !== null) return;
      const delay = Math.min(1000 * 2 ** failures, 30_000);
      failures = Math.min(failures + 1, 5);
      timer = timers.setTimeout(() => {
        timer = null;
        wake();
      }, delay);
    },
  };
}
