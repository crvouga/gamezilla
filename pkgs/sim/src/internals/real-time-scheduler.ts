// @io-wall-ok — wall-clock scheduler for realTimeRuntime
import type { VirtualClock } from './clock';
import type { TaskBody, Scheduler as VirtualScheduler } from './scheduler';
import type { Scheduler } from './scheduler-api';

/** Wall time cannot jump; the `virtualTime` capability gates callers. */
function cannotSkip(): Promise<void> {
  return Promise.reject(
    new Error('wall scheduler: time cannot skip ahead on the wall clock')
  );
}

/**
 * Wall-clock scheduler. `advance(ms)` waits real time; `waitForIdle` yields briefly.
 */
export function createWallScheduler(opts?: {
  readonly settleMs?: number;
}): Scheduler {
  const settleMs = opts?.settleMs ?? 0;
  let nowMs = Date.now();
  const clock: VirtualClock = {
    now: () => nowMs,
    advance(ms) {
      nowMs += ms;
    },
    set(ms) {
      nowMs = ms;
    },
    reset(ms) {
      nowMs = ms;
    },
  };

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const underlying = {
    clock,
    scheduleAt(at: number, run: TaskBody) {
      const delay = Math.max(0, at - Date.now());
      const t = setTimeout(() => {
        timers.delete(t);
        nowMs = Date.now();
        void run();
      }, delay);
      timers.add(t);
    },
    scheduleAfter(ms: number, run: TaskBody) {
      const t = setTimeout(
        () => {
          timers.delete(t);
          nowMs = Date.now();
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
      nowMs = Date.now();
    },
    skip: cannotSkip,
    async runUntilQuiescent() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
      nowMs = Date.now();
    },
    async runUntil() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
      nowMs = Date.now();
      return true;
    },
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
      nowMs = Date.now();
    },
    async waitForIdle() {
      await new Promise<void>((r) => setTimeout(r, settleMs));
      nowMs = Date.now();
    },
  };
}
