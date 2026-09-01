import type { SeededRng } from '@pkgs/uuid';
import type { SimClock } from './clock';
import {
  type DrainContext,
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
 * Discrete-event scheduler with quiescence-probe drains and seeded
 * same-time tie-breaking. Nested drain throws `SimScheduler: nested drain`.
 */
export type SimScheduler = {
  readonly clock: SimClock;
  readonly scheduleAt: (at: number, run: SimTask, label?: string) => void;
  readonly scheduleAfter: (ms: number, run: SimTask, label?: string) => void;
  readonly pendingCount: () => number;
  /** Absolute ms of the soonest pending task, or null if idle. */
  readonly nextDueAt: () => number | null;
  /** Drop all pending tasks without running them. */
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
  /** Seeded RNG for same-time tie-breaks (`fork('sched')`). */
  readonly schedRng?: SeededRng;
};

export function createSimScheduler(
  clock: SimClock,
  opts?: CreateSimSchedulerOpts
): SimScheduler {
  const heap: Queued[] = [];
  let seq = 0;
  let draining = false;
  const trace = opts?.trace;
  const schedRng = opts?.schedRng;
  const inFlight: DrainContext['inFlight'] = [];

  const makeCtx = (): DrainContext => ({
    heap,
    clock,
    inFlight,
    ...(schedRng !== undefined ? { schedRng } : {}),
    ...(trace !== undefined ? { trace } : {}),
  });

  const scheduleAt = (at: number, run: SimTask, label = 'task'): void => {
    if (!(at >= 0) || !Number.isFinite(at)) {
      throw new Error(`SimScheduler.scheduleAt: bad at ${at}`);
    }
    const taskId = seq++;
    pushQueued(heap, { at, seq: taskId, run, label });
    trace?.record({
      type: 'timer_create',
      taskId,
      at,
      reason: label,
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
    scheduleAfter: (ms, run, label) =>
      scheduleAt(clock.now() + Math.max(0, ms), run, label),
    pendingCount: () => heap.length,
    nextDueAt: () => (heap.length === 0 ? null : heap[0]!.at),
    clear: () => {
      heap.length = 0;
    },
    runFor: (durationMs) =>
      withDrainGate(() => runForDuration(makeCtx(), durationMs)),
    runUntilIdle: (opts) =>
      withDrainGate(() => runUntilIdleHeap(makeCtx(), opts)),
    runUntil: (pred, opts) =>
      withDrainGate(() =>
        runUntilPred({
          ctx: makeCtx(),
          pred,
          ...(opts !== undefined ? { opts } : {}),
        })
      ),
  };
}
