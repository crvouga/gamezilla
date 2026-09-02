import { createSimDeps, type SimScheduler } from '@pkgs/determinism';

import type { Timers } from '../client/sim-ports';

export type SimTestDriver = {
  readonly clock: { now(): number };
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
  const deps = createSimDeps({ seed: 1, startMs: 0 });
  const { scheduler, timers } = deps;
  const clock = scheduler.clock;
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
