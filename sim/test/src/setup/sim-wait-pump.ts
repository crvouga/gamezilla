/**
 * Virtual-time drain pump for in-process sim waits.
 * Advances one-shot timers + microtasks without wall sleep.
 */

import { setImmediate as nodeSetImmediate } from 'node:timers';
import type { SimClock } from '@pkgs/clock';
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
 * Build a {@link WaitPump} that drains the sim clock (one-shots + due work)
 * without wall 50ms sleeps. Intervals (reconcile) do not block — each tick
 * advances at most {@link SIM_WAIT_STEP_MS} toward the next due timer.
 */
export function createSimWaitPump(args: {
  readonly clock: SimClock;
}): WaitPump {
  return async () => {
    try {
      args.clock.advance(0);
    } catch {
      // clock may have been reset/disposed mid-wait
    }
    await flushMicrotasks();

    const next = (() => {
      try {
        return args.clock.nextDueAt();
      } catch {
        return null;
      }
    })();
    if (next !== null) {
      const delta = Math.max(0, next - args.clock.now());
      const step = Math.min(delta, SIM_WAIT_STEP_MS);
      if (step > 0) {
        try {
          args.clock.advance(step);
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
