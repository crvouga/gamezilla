import type { SeededRng } from '@pkgs/uuid';
import type { VirtualClock } from './clock';
import {
  createScheduler as createVirtualSchedulerInner,
  type Scheduler as VirtualScheduler,
} from './scheduler';
import type { TraceRecorder } from './trace';

export type TaskBody = () => void | Promise<void>;

/**
 * Session-facing scheduler: schedule work, advance time, wait for idle.
 * `virtual: true` means advance is free (virtual clock); false means wall wait.
 */
export type Scheduler = {
  readonly virtual: boolean;
  readonly schedule: (task: TaskBody, atMs?: number) => { dispose(): void };
  readonly advance: (ms: number) => Promise<void>;
  readonly waitForIdle: () => Promise<void>;
  /** Escape hatch for runtimes / legacy adapters that need the heap API. */
  readonly underlying: VirtualScheduler;
  readonly clock: VirtualClock;
};

export type CreateVirtualSchedulerOpts = {
  readonly clock: VirtualClock;
  readonly choiceRng?: SeededRng;
  readonly trace?: TraceRecorder;
};

export function createVirtualScheduler(
  opts: CreateVirtualSchedulerOpts
): Scheduler {
  const underlying = createVirtualSchedulerInner(opts.clock, {
    ...(opts.choiceRng !== undefined ? { choiceRng: opts.choiceRng } : {}),
    ...(opts.trace !== undefined ? { trace: opts.trace } : {}),
  });
  const cancelled = new WeakSet<object>();

  return {
    virtual: true,
    clock: opts.clock,
    underlying,
    schedule(task, atMs) {
      const handle = { disposed: false };
      const run = () => {
        if (handle.disposed || cancelled.has(handle)) return;
        return task();
      };
      if (atMs === undefined) {
        underlying.scheduleAfter(0, run);
      } else {
        underlying.scheduleAt(atMs, run);
      }
      return {
        dispose() {
          handle.disposed = true;
          cancelled.add(handle);
        },
      };
    },
    async advance(ms) {
      await underlying.runFor(ms);
    },
    async waitForIdle() {
      // Due-at-now + in-flight only — do not advance virtual time to future
      // timers (match-clock FlagFall, delayed net frames). Explicit
      // `advance` / `runFor` owns time travel.
      await underlying.runFor(0);
    },
  };
}
