/**
 * Virtual-time drain pump for rntl sim waits.
 * Advances scheduled work via {@link VirtualScheduler} without wall sleep.
 */

import { setImmediate as nodeSetImmediate } from 'node:timers';
import type { VirtualScheduler } from '@pkgs/dst/kernel';
import type { WaitPump } from '@pkgs/ui-testing';

/**
 * Max sim-time advanced per pump tick. Covers upload IDLE_DELAY (100) and one
 * reconcile interval (500) without a wall sleep.
 */
export const SIM_WAIT_STEP_MS = 500;

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    nodeSetImmediate(resolve);
  });
}

/**
 * Serialize overlapping {@link VirtualScheduler.runFor} calls from the UI harness.
 * Nested drain from a scheduled task still throws; concurrent mount / focus /
 * wait-pump callers queue instead of racing the drain gate.
 */
export function createSerializedRunFor(
  scheduler: VirtualScheduler
): (durationMs: number) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (durationMs: number): Promise<void> => {
    const run = tail.then(async () => {
      await scheduler.runFor(durationMs);
      // React 18 / RNTL apply updates on microtasks + setImmediate.
      // Without this, `passTime` / `untilObserved` spin virtual time
      // while the tree stays stale.
      await flushMicrotasks();
      await yieldEventLoop();
    });
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

/**
 * Build a {@link WaitPump} that drains the sim scheduler (due tasks +
 * microtasks) without wall 50ms sleeps.
 */
export function createSimWaitPump(args: {
  readonly scheduler: VirtualScheduler;
  readonly runFor?: (durationMs: number) => Promise<void>;
}): WaitPump {
  const runFor =
    args.runFor ?? ((durationMs) => args.scheduler.runFor(durationMs));
  return async () => {
    try {
      await runFor(0);
    } catch {
      // scheduler may have been cleared/disposed mid-wait
    }
    await flushMicrotasks();

    const next = (() => {
      try {
        return args.scheduler.nextDueAt();
      } catch {
        return null;
      }
    })();
    if (next !== null) {
      const delta = Math.max(0, next - args.scheduler.clock.now());
      const step = Math.min(delta, SIM_WAIT_STEP_MS);
      if (step > 0) {
        try {
          await runFor(step);
        } catch {
          // ignore disposed clock
        }
        await flushMicrotasks();
      }
    }

    // Avoid a tight CPU spin when nothing is due yet.
    await yieldEventLoop();
  };
}
