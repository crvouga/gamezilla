/**
 * Injectable wall / virtual time for deterministic simulation.
 * Production uses {@link wallClock} / {@link wallTimers}.
 */

export type Clock = {
  /** Epoch milliseconds (virtual or wall). */
  readonly now: () => number;
};

export type Timers = {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
  readonly setInterval: (fn: () => void, ms: number) => unknown;
  readonly clearInterval: (handle: unknown) => void;
};
