import { type Session, virtualTimeRuntime } from '@pkgs/sim';

import type { Timers } from '../client/sim-ports';

export type SimTestDriver = {
  readonly clock: { now(): number };
  readonly scheduler: Session['scheduler']['underlying'];
  readonly timers: Timers;
  readonly now: () => number;
  readonly random: () => number;
  readonly runFor: (ms: number) => Promise<void>;
  readonly runUntil: (
    pred: () => boolean,
    opts?: { readonly maxVirtualMs?: number }
  ) => Promise<boolean>;
  readonly dispose: () => Promise<void>;
};

/** Lightweight driver for unit tests that inject timers into runtime/push. */
export async function createSimTestDriver(): Promise<SimTestDriver> {
  const session = await virtualTimeRuntime().open(0);
  const scheduler = session.scheduler.underlying;
  const timers = session.ports.timers;
  const clock = session.ports.clock;
  return {
    clock,
    scheduler,
    timers,
    now: () => clock.now(),
    random: () => 0,
    runFor: (ms) => scheduler.runFor(ms),
    runUntil: (pred, opts) => scheduler.runUntil(pred, opts),
    dispose: () => session.dispose(),
  };
}
