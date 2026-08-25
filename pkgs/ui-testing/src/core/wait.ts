import type { Timers } from '@pkgs/clock';

import { TimeoutError } from './errors';

/**
 * Advance product work between wait polls (virtual-time drain). When set,
 * replaces the default wall `intervalMs` sleep.
 */
export type WaitPump = () => void | Promise<void>;

/** Polling knobs shared by driver waitFor / assertions / waitUntil. */
export type WaitPollOptions = {
  /** Maximum wall time to poll. Default 5_000. */
  timeoutMs?: number;
  /** Delay between polls when `pump` is unset. Default 50. */
  intervalMs?: number;
  /** Human-readable description used in the timeout error. */
  description?: string;
  /**
   * Invoked after each unsuccessful poll attempt (before the sleep / pump).
   * Used by simulation reports to capture mid-wait UI frames.
   */
  onPoll?: () => void | Promise<void>;
  /**
   * Event / idle drain instead of wall sleep. In-process sim wires a virtual
   * clock pump here; Playwright / Detox leave this unset.
   */
  pump?: WaitPump;
};

export type WaitOptions = WaitPollOptions & {
  /** Epoch ms clock (wall for deadlines). */
  now: () => number;
  /** Timers for poll sleep when `pump` is unset. */
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
    if (options.onPoll) {
      await options.onPoll();
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
