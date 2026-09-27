import type { SeededRng } from '@pkgs/uuid';
import type { VirtualClock } from './clock';
import {
  type DrainContext,
  pushTask,
  runForDuration,
  runUntilPred,
  runUntilQuiescentHeap,
  sleepForDuration,
  type Task,
  type TaskBody,
} from './scheduler-core';
import type { TraceRecorder } from './trace';

export type { Task, TaskBody };

/**
 * Discrete-event Scheduler over the virtual clock. Fires due Tasks one at a
 * time with a quiescence probe between them; same-time ties are a Step.
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
  /**
   * Jump `durationMs` with nothing running meanwhile; every Task that fell
   * due fires once on waking (see `sleepForDuration`).
   */
  readonly sleep: (durationMs: number) => Promise<void>;
  /** Advances made while wall work was still in flight; see `DrainStats`. */
  readonly starvedAdvances: () => number;
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
  /** Seeded RNG that resolves the same-time scheduling Step. */
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
  const stats: DrainContext['stats'] = { starvedAdvances: 0 };

  // A fresh budget per top-level drain: the ceiling is per drain, not per run.
  const makeCtx = (): DrainContext => ({
    heap,
    clock,
    inFlight,
    budget: { steps: 0 },
    stats,
    ...(choiceRng !== undefined ? { choiceRng } : {}),
    ...(trace !== undefined ? { trace } : {}),
  });

  const scheduleAt = (at: number, run: TaskBody, label = 'task'): void => {
    if (!(at >= 0) || !Number.isFinite(at)) {
      throw new Error(`Scheduler.scheduleAt: bad at ${at}`);
    }
    const taskId = seq++;
    pushTask(heap, { at, id: taskId, run, label });
    trace?.record({ type: 'task_create', taskId, at, label });
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
    starvedAdvances: () => stats.starvedAdvances,
    runFor: (durationMs) =>
      withDrainGate(() => runForDuration(makeCtx(), durationMs)),
    sleep: (durationMs) =>
      withDrainGate(() => sleepForDuration(makeCtx(), durationMs)),
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
