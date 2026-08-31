import {
  createSimClock,
  createSimScheduler,
  createSimTimers,
  type SimClock,
  type SimScheduler,
} from '@pkgs/dst';

import type { Timers } from '../client/sim-ports';

export type SimTestDriver = {
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly now: () => number;
  readonly random: () => number;
  readonly runFor: (ms: number) => Promise<void>;
  readonly runUntil: (
    pred: () => boolean,
    opts?: { readonly maxVirtualMs?: number }
  ) => Promise<boolean>;
};

/** Lightweight driver for unit tests that inject timers into runtime/push. */
export function createSimTestDriver(): SimTestDriver {
  const clock = createSimClock(0);
  const scheduler = createSimScheduler(clock);
  const timers = createSimTimers(scheduler);
  return {
    clock,
    scheduler,
    timers,
    now: () => clock.now(),
    random: () => 0,
    runFor: (ms) => scheduler.runFor(ms),
    runUntil: (pred, opts) => scheduler.runUntil(pred, opts),
  };
}
