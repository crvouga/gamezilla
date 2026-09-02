import type { SeededRng } from '@pkgs/uuid';
import type { VirtualClock } from './clock';
import {
  type DrainContext,
  pushTask,
  runForDuration,
  runUntilPred,
  runUntilQuiescentHeap,
  type Task,
  type TaskBody,
} from './scheduler-core';
import type { TraceRecorder } from './trace';

export type { Task, TaskBody };

/**
 * Discrete-event Scheduler over the virtual clock. Fires due Tasks one at a
 * time with a quiescence probe between them; same-time ties are a Choice.
 * Nested drain throws `Scheduler: nested drain`.
 */
export type Scheduler = {
  readonly clock: VirtualClock;
  readonly scheduleAt: (at: number, run: TaskBody, label?: string) => void;
  readonly scheduleAfter: (ms: number, run: TaskBody, label?: string) => void;
  readonly pendingTaskCount: () => number;
  /** Absolute ms of the soonest pending Task, or null when none is pending. */
  readonly nextDueAt: () => number | null;
  /** Drop all pending Tasks and reset virtual time to `atMs`. */
  readonly reset: (atMs: number) => void;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly runUntilQuiescent: (opts?: {
    readonly maxSteps?: number;
    readonly maxVirtualMs?: number;
  }) => Promise<void>;
  readonly runUntil: (
    pred: () => boolean | Promise<boolean>,
    opts?: { readonly maxVirtualMs?: number; readonly maxSteps?: number }
  ) => Promise<boolean>;
};

export type SchedulerOptions = {
  readonly trace?: TraceRecorder;
  /** Seeded RNG that resolves the same-time scheduling Choice. */
  readonly choiceRng?: SeededRng;
};

export function createScheduler(
  clock: VirtualClock,
  opts?: SchedulerOptions
): Scheduler {
  const heap: Task[] = [];
  let seq = 0;
  let draining = false;
  const trace = opts?.trace;
  const choiceRng = opts?.choiceRng;
  const inFlight: DrainContext['inFlight'] = [];

  const makeCtx = (): DrainContext => ({
    heap,
    clock,
    inFlight,
    ...(choiceRng !== undefined ? { choiceRng } : {}),
    ...(trace !== undefined ? { trace } : {}),
  });

  const scheduleAt = (at: number, run: TaskBody, label = 'task'): void => {
    if (!(at >= 0) || !Number.isFinite(at)) {
      throw new Error(`Scheduler.scheduleAt: bad at ${at}`);
    }
    const taskId = seq++;
    pushTask(heap, { at, id: taskId, run, label });
    trace?.record({
      type: 'task_create',
      taskId,
      at,
      label,
    });
  };

  const withDrainGate = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (draining) throw new Error('Scheduler: nested drain');
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
    pendingTaskCount: () => heap.length,
    nextDueAt: () => (heap.length === 0 ? null : heap[0]!.at),
    reset(atMs) {
      heap.length = 0;
      clock.reset(atMs);
    },
    runFor: (durationMs) =>
      withDrainGate(() => runForDuration(makeCtx(), durationMs)),
    runUntilQuiescent: (opts) =>
      withDrainGate(() => runUntilQuiescentHeap(makeCtx(), opts)),
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
