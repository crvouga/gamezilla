import type { Clock, Timers } from './types';

export type SimClock = Clock & {
  readonly advance: (ms: number) => void;
  readonly set: (ms: number) => void;
  /** Set absolute time and drop pending sim timers (time-travel restore). */
  readonly reset: (ms: number) => void;
};

type TimerEntry = {
  readonly id: number;
  at: number;
  readonly fn: () => void;
  readonly intervalMs: number | null;
};

export type CreateSimClockArgs = {
  readonly startMs?: number;
};

export type SimClockBundle = {
  readonly clock: SimClock;
  readonly timers: Timers;
};

/** Virtual clock + timers for simulation (no wall `Date` / `setTimeout`). */
export function createSimClock(args: CreateSimClockArgs = {}): SimClockBundle {
  let now = args.startMs ?? 0;
  let nextId = 1;
  const entries = new Map<number, TimerEntry>();

  const flushDue = (): void => {
    for (;;) {
      let due: TimerEntry | null = null;
      for (const e of entries.values()) {
        if (e.at <= now && (due === null || e.at < due.at)) due = e;
      }
      if (due === null) break;
      if (due.intervalMs === null) {
        entries.delete(due.id);
      } else {
        due.at = now + due.intervalMs;
      }
      due.fn();
    }
  };

  const clock: SimClock = {
    now: () => now,
    advance(ms: number): void {
      if (!(ms >= 0) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.advance: bad delta ${ms}`);
      }
      now += ms;
      flushDue();
    },
    set(ms: number): void {
      if (!(ms >= now) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.set: cannot go backwards (${ms} < ${now})`);
      }
      now = ms;
      flushDue();
    },
    reset(ms: number): void {
      if (!Number.isFinite(ms)) {
        throw new Error(`SimClock.reset: bad time ${ms}`);
      }
      now = ms;
      entries.clear();
    },
  };

  const timers: Timers = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      entries.set(id, {
        id,
        at: now + Math.max(0, ms),
        fn,
        intervalMs: null,
      });
      return id;
    },
    clearTimeout: (handle) => {
      entries.delete(handle as number);
    },
    setInterval: (fn, ms) => {
      const id = nextId++;
      const intervalMs = Math.max(0, ms);
      entries.set(id, {
        id,
        at: now + intervalMs,
        fn,
        intervalMs,
      });
      return id;
    },
    clearInterval: (handle) => {
      entries.delete(handle as number);
    },
  };

  return { clock, timers };
}
