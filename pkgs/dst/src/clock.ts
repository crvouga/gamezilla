/** Bare clock — advanced only via SimScheduler.run* (and reset). */
export type SimClock = {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly set: (ms: number) => void;
  readonly reset: (ms: number) => void;
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
    reset(ms: number): void {
      if (!Number.isFinite(ms)) {
        throw new Error(`SimClock.reset: bad time ${ms}`);
      }
      t = ms;
    },
  };
}
