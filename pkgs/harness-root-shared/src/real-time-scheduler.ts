// @io-wall-ok — wall-clock scheduler for realTimeRuntime
import type { VirtualClock } from './clock';
import type { Scheduler as VirtualScheduler } from './scheduler';
import type { Scheduler } from './scheduler-api';
import type { TaskBody } from './scheduler-types';

/** Wall time passes at its own pace: it cannot jump ahead of the work. */
function cannotSleep(): Promise<void> {
  return Promise.reject(
    new Error('a wall-clock scheduler cannot sleep through time')
  );
}

/**
 * Wall-clock scheduler. `advance(ms)` waits real time; `waitForIdle` yields briefly.
 */
export function createWallScheduler(opts?: {
  readonly settleMs?: number;
}): Scheduler {
  const settleMs = opts?.settleMs ?? 0;
  const clock: VirtualClock = {
    now: () => Date.now(),
    advance() {
      throw new Error('a wall clock cannot jump ahead');
    },
    set() {
      throw new Error('a wall clock cannot be reassigned');
    },
    reset() {
      throw new Error('a wall clock cannot be reset');
    },
  };

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const underlying = {
    clock,
    scheduleAt(at: number, run: TaskBody) {
      const delay = Math.max(0, at - Date.now());
      const t = setTimeout(() => {
        timers.delete(t);
        void run();
      }, delay);
      timers.add(t);
    },
    scheduleAfter(ms: number, run: TaskBody) {
      const t = setTimeout(
        () => {
          timers.delete(t);
          void run();
        },
        Math.max(0, ms)
      );
      timers.add(t);
    },
    pendingTaskCount: () => timers.size,
    nextDueAt: () => null as number | null,
    reset() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
    async runFor(durationMs: number) {
      await new Promise<void>((r) => setTimeout(r, Math.max(0, durationMs)));
    },
    async runUntilQuiescent() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
    },
    async runUntil() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
      return true;
    },
    sleep: cannotSleep,
    // Wall time cannot run ahead of the work it is waiting for, so nothing
    // here is ever a starved advance.
    starvedAdvances: () => 0,
  } as VirtualScheduler;

  return {
    virtual: false,
    clock,
    underlying,
    starvedAdvances: () => 0,
    schedule(task, atMs) {
      let t: ReturnType<typeof setTimeout> | undefined;
      if (atMs === undefined) {
        t = setTimeout(() => void task(), 0);
      } else {
        t = setTimeout(() => void task(), Math.max(0, atMs - Date.now()));
      }
      timers.add(t);
      return {
        dispose() {
          if (t !== undefined) {
            clearTimeout(t);
            timers.delete(t);
          }
        },
      };
    },
    async advance(ms) {
      await new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
    },
    async waitForIdle() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
    },
  };
}
