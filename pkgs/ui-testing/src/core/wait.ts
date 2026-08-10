import type { Timers } from '@pkgs/clock';

import { TimeoutError } from './errors';

/** Polling knobs shared by driver waitFor / assertions / waitUntil. */
export type WaitPollOptions = {
  /** Maximum time to poll. Default 5_000. */
  timeoutMs?: number;
  /** Delay between polls. Default 50. */
  intervalMs?: number;
  /** Human-readable description used in the timeout error. */
  description?: string;
};

export type WaitOptions = WaitPollOptions & {
  /** Epoch ms clock. */
  now: () => number;
  /** Timers for poll sleep. */
  timers: Timers;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_INTERVAL_MS = 50;

/**
 * Poll `fn` until it returns a truthy value (or resolves to one).
 * Runner-agnostic — throws {@link TimeoutError} on failure.
 */
export async function waitUntil<T>(
  fn: () => T | Promise<T>,
  options: WaitOptions
): Promise<NonNullable<T>> {
  const now = options.now;
  const timers = options.timers;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const description = options.description ?? 'condition';
  const deadline = now() + timeoutMs;
  let lastError: unknown;

  while (now() <= deadline) {
    try {
      const value = await fn();
      if (value) {
        return value as NonNullable<T>;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs, timers);
  }

  throw new TimeoutError(
    `Timed out after ${timeoutMs}ms waiting for ${description}`,
    timeoutMs,
    { cause: lastError }
  );
}

function sleep(ms: number, timers: Timers): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}
