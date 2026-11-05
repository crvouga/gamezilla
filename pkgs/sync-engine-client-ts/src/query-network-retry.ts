import type { Timers } from '@pkgs/clock-shared-ts/types';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';

/** Retry a failed read; a successful full sweep leaves no background polling. */
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
      const networkError =
        error instanceof HttpNetworkError ||
        (error instanceof Error && error.name === 'HttpNetworkError');
      if (!networkError || timer !== null) return;
      const delay = Math.min(1000 * 2 ** failures, 30_000);
      failures = Math.min(failures + 1, 5);
      timer = timers.setTimeout(() => {
        timer = null;
        wake();
      }, delay);
    },
  };
}
