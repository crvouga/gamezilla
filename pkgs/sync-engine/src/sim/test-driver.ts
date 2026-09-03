import {
  createScheduler,
  createTimers,
  createVirtualClock,
  type VirtualScheduler,
} from '@pkgs/dst/kernel';

import type { Timers } from '../client/sim-ports';

export type SimTestDriver = {
  readonly clock: { now(): number };
  readonly scheduler: VirtualScheduler;
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
  const clock = createVirtualClock(0);
  const scheduler = createScheduler(clock);
  const timers = createTimers(scheduler);
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
