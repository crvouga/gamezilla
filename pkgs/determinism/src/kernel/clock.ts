/**
 * Virtual clock owned by the Scheduler. `now()` is the read-only view handed
 * to the SUT; the mutators exist only so the Scheduler can advance time at
 * quiescence. Nothing outside the kernel may call them.
 */
export type VirtualClock = {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly set: (ms: number) => void;
  readonly reset: (ms: number) => void;
};

export function createVirtualClock(startMs = 0): VirtualClock {
  let t = startMs;
  return {
    now: () => t,
    advance(ms: number): void {
      if (!(ms >= 0) || !Number.isFinite(ms)) {
        throw new Error(`VirtualClock.advance: bad delta ${ms}`);
      }
      t += ms;
    },
    set(ms: number): void {
      if (!(ms >= t) || !Number.isFinite(ms)) {
        throw new Error(`VirtualClock.set: cannot go backwards (${ms} < ${t})`);
      }
      t = ms;
    },
    reset(ms: number): void {
      if (!Number.isFinite(ms)) {
        throw new Error(`VirtualClock.reset: bad time ${ms}`);
      }
      t = ms;
    },
  };
}
