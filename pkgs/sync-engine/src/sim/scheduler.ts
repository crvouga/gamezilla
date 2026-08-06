import type { SimClock } from './clock';
import {
  pushQueued,
  runForDuration,
  runUntilIdleHeap,
  runUntilPred,
  type Queued,
  type SimTask,
} from './scheduler-core';

export type { SimTask };

/**
 * Discrete-event scheduler. Same-time events fire in insertion order.
 * `runFor` / `runUntilIdle` drain timers and await async tasks before advancing.
 */
export type SimScheduler = {
  readonly clock: SimClock;
  readonly scheduleAt: (at: number, run: SimTask) => void;
  readonly scheduleAfter: (ms: number, run: SimTask) => void;
  readonly pendingCount: () => number;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly runUntilIdle: (opts?: {
    readonly maxSteps?: number;
    readonly maxVirtualMs?: number;
  }) => Promise<void>;
  readonly runUntil: (
    pred: () => boolean | Promise<boolean>,
    opts?: { readonly maxVirtualMs?: number; readonly maxSteps?: number }
  ) => Promise<boolean>;
};

export function createSimScheduler(clock: SimClock): SimScheduler {
  const heap: Queued[] = [];
  let seq = 0;
  let draining = false;

  const scheduleAt = (at: number, run: SimTask): void => {
    if (!(at >= 0) || !Number.isFinite(at)) {
      throw new Error(`SimScheduler.scheduleAt: bad at ${at}`);
    }
    pushQueued(heap, { at, seq: seq++, run });
  };

  const withDrainGate = async (fn: () => Promise<void>): Promise<void> => {
    if (draining) throw new Error('SimScheduler: nested run');
    draining = true;
    try {
      await fn();
    } finally {
      draining = false;
    }
  };

  return {
    clock,
    scheduleAt,
    scheduleAfter: (ms, run) => scheduleAt(clock.now() + Math.max(0, ms), run),
    pendingCount: () => heap.length,
    runFor: (durationMs) =>
      withDrainGate(() => runForDuration(heap, clock, durationMs)),
    runUntilIdle: (opts) =>
      withDrainGate(() => runUntilIdleHeap(heap, clock, opts)),
    runUntil: async (pred, opts) => {
      if (await pred()) return true;
      if (draining) throw new Error('SimScheduler: nested runUntil');
      draining = true;
      try {
        return await runUntilPred(heap, clock, pred, opts);
      } finally {
        draining = false;
      }
    },
  };
}
