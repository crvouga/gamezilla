/** Monotonic virtual clock; advanced only by the scheduler. */

export type SimClock = {
  readonly now: () => number;
  /** Advance by ms (must be >= 0). Called only from SimScheduler. */
  readonly advance: (ms: number) => void;
  /** Jump to absolute time (must be >= now). */
  readonly set: (ms: number) => void;
};

export function createSimClock(startMs = 0): SimClock {
  let t = startMs;
  return {
    now: () => t,
    advance(ms: number): void {
      if (!(ms >= 0) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.advance: bad delta ${ms}`);
      }
      t += ms;
    },
    set(ms: number): void {
      if (!(ms >= t) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.set: cannot go backwards (${ms} < ${t})`);
      }
      t = ms;
    },
  };
}
