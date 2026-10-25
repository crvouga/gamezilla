import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';

type Timers = Session['ports']['timers'];
type Clock = Session['ports']['clock'];
type Handle = {
  inner: unknown;
  live: boolean;
  readonly due: number;
  readonly ms: number;
};

/** Scheduling lateness of every timer that fired, in virtual milliseconds. */
export type TimerLateness = { fired: number; totalMs: number; maxMs: number };

/**
 * Injected timers that count what is still outstanding and can stall: while a
 * stall lasts, a due callback waits until the stall ends, as when a host's
 * event loop is blocked. Interval timers are refused; the room and the
 * simulation driver only use one-shot timers.
 */
export type TimerProbe = {
  readonly timers: Timers;
  /** Scheduled callbacks that have neither fired nor been cleared. */
  readonly outstanding: () => number;
  readonly stall: (ms: number) => void;
  readonly stalledUntil: () => number;
  readonly lateness: () => TimerLateness;
  readonly resetLateness: () => void;
  /** When the earliest outstanding timer of exactly `ms` is due, if any. */
  readonly nextDueOf: (ms: number) => number | null;
};

export function timerProbe(clock: Clock, inner: Timers): TimerProbe {
  const live = new Set<Handle>();
  let stalledUntil = Number.NEGATIVE_INFINITY;
  let lateness: TimerLateness = { fired: 0, totalMs: 0, maxMs: 0 };

  const arm = (handle: Handle, fn: () => void, ms: number): void => {
    handle.inner = inner.setTimeout(() => {
      if (!handle.live) return;
      const now = clock.now();
      if (now < stalledUntil) {
        arm(handle, fn, stalledUntil - now);
        return;
      }
      handle.live = false;
      live.delete(handle);
      const late = Math.max(0, now - handle.due);
      lateness = {
        fired: lateness.fired + 1,
        totalMs: lateness.totalMs + late,
        maxMs: Math.max(lateness.maxMs, late),
      };
      fn();
    }, ms);
  };
  const clear = (value: unknown): void => {
    const handle = value as Handle | null | undefined;
    if (handle === null || handle === undefined || !live.has(handle)) return;
    handle.live = false;
    live.delete(handle);
    inner.clearTimeout(handle.inner);
  };
  const timers: Timers = {
    setTimeout: (fn: () => void, ms: number): unknown => {
      const handle: Handle = {
        inner: null,
        live: true,
        due: clock.now() + Math.max(0, ms),
        ms,
      };
      live.add(handle);
      arm(handle, fn, ms);
      return handle;
    },
    clearTimeout: clear,
    setInterval: () => {
      throw new Error('the timer probe supports one-shot timers only');
    },
    clearInterval: clear,
  };
  return {
    timers,
    outstanding: () => live.size,
    stall: (ms) => {
      if (!Number.isFinite(ms) || ms <= 0)
        throw new Error('a stall lasts a positive number of milliseconds');
      stalledUntil = Math.max(stalledUntil, clock.now() + ms);
    },
    stalledUntil: () => stalledUntil,
    lateness: () => ({ ...lateness }),
    resetLateness: () => {
      lateness = { fired: 0, totalMs: 0, maxMs: 0 };
    },
    nextDueOf: (ms) => {
      let due: number | null = null;
      for (const handle of live)
        if (handle.ms === ms && (due === null || handle.due < due))
          due = handle.due;
      return due;
    },
  };
}
