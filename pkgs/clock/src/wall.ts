import type { Clock, Timers } from './types';

/** Production clock backed by `Date.now`. */
export const wallClock: Clock = {
  now: () => Date.now(),
};

/** Production timers backed by `globalThis.setTimeout` / `clearTimeout`. */
export const wallTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

export function resolveClock(override?: Clock): Clock {
  return override ?? wallClock;
}

export function resolveTimers(override?: Timers): Timers {
  return override ?? wallTimers;
}

/** Convenience: resolve a `now()` function (sync-engine style). */
export function resolveNow(override?: () => number): () => number {
  return override ?? wallClock.now;
}
