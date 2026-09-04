import type { Timers } from '@pkgs/clock';

import { TimeoutError } from './errors';

/**
 * Advance product work between wait polls (virtual-time drain). When set on
 * an rntl driver constructor, replaces the default wall sleep between
 * checks. Not part of the public {@link Driver.wait} options.
 */
export type WaitPump = () => void | Promise<void>;

/** Internal options for {@link waitUntil} (rntl helper only). */
export type WaitUntilOptions = {
  /** Maximum wall time to poll. Default 5_000. */
  timeoutMs?: number;
  /** Delay between polls when `pump` is unset. Default 50. */
  intervalMs?: number;
  /** Human-readable description used in the timeout error. */
  description?: string;
  /** Event / idle drain instead of wall sleep. */
  pump?: WaitPump;
  /** Epoch ms clock (wall for deadlines). */
  now: () => number;
  /** Timers for poll sleep when `pump` is unset. */
  timers: Timers;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_INTERVAL_MS = 50;

/**
 * Poll `fn` until it returns a truthy value (or resolves to one).
 * RNTL-only helper — Bun.WebView / Detox must not call this.
 * Throws {@link TimeoutError} on failure.
 */
export async function waitUntil<T>(
  fn: () => T | Promise<T>,
  options: WaitUntilOptions
): Promise<NonNullable<T>> {
  const now = options.now;
  const timers = options.timers;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const description = options.description ?? 'condition';
  const pump = options.pump;
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
    if (pump !== undefined) {
      await pump();
    } else {
      await sleep(intervalMs, timers);
    }
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
