import type { SimClock } from './clock';
import {
  pushQueued,
  type Queued,
  runForDuration,
  runUntilIdleHeap,
  runUntilPred,
  type SimTask,
} from './scheduler-core';
import type { SimTrace } from './trace';

export type { SimTask };

/**
 * Discrete-event scheduler. Same-time events fire in insertion order.
 * Nested drain (any overlapping runFor / runUntilIdle / runUntil) throws
 * `SimScheduler: nested drain`.
 */
export type SimScheduler = {
  readonly clock: SimClock;
  readonly scheduleAt: (at: number, run: SimTask) => void;
  readonly scheduleAfter: (ms: number, run: SimTask) => void;
  readonly pendingCount: () => number;
  /** Absolute ms of the soonest pending task, or null if idle. */
  readonly nextDueAt: () => number | null;
  /** Drop all pending tasks without running them (checkpoint restore). */
  readonly clear: () => void;
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

export type CreateSimSchedulerOpts = {
  readonly trace?: SimTrace;
};

export function createSimScheduler(
  clock: SimClock,
  opts?: CreateSimSchedulerOpts
): SimScheduler {
  const heap: Queued[] = [];
  let seq = 0;
  let draining = false;
  const trace = opts?.trace;

  const scheduleAt = (at: number, run: SimTask): void => {
    if (!(at >= 0) || !Number.isFinite(at)) {
      throw new Error(`SimScheduler.scheduleAt: bad at ${at}`);
    }
    const taskId = seq++;
    pushQueued(heap, { at, seq: taskId, run });
    trace?.record({
      now: clock.now(),
      type: 'schedule',
      at,
      taskId,
    });
  };

  const withDrainGate = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (draining) throw new Error('SimScheduler: nested drain');
    draining = true;
    try {
      return await fn();
    } finally {
      draining = false;
    }
  };

  return {
    clock,
    scheduleAt,
    scheduleAfter: (ms, run) => scheduleAt(clock.now() + Math.max(0, ms), run),
    pendingCount: () => heap.length,
    nextDueAt: () => (heap.length === 0 ? null : heap[0]!.at),
    clear: () => {
      heap.length = 0;
    },
    runFor: (durationMs) =>
      withDrainGate(() => runForDuration(heap, clock, durationMs, trace)),
    runUntilIdle: (opts) =>
      withDrainGate(() => runUntilIdleHeap(heap, clock, opts, trace)),
    runUntil: (pred, opts) =>
      withDrainGate(() =>
        runUntilPred({
          heap,
          clock,
          pred,
          ...(opts !== undefined ? { opts } : {}),
          ...(trace !== undefined ? { trace } : {}),
        })
      ),
  };
}
