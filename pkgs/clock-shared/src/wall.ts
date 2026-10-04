// @io-wall-ok
import type { Clock, Timers } from './types';

/** Production clock backed by `Date.now`. */
export const wallClock: Clock = {
  now: () => Date.now(),
};

/** Production timers backed by `globalThis` timer APIs. */
export const wallTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (handle) => {
    globalThis.clearInterval(
      handle as ReturnType<typeof globalThis.setInterval>
    );
  },
};
