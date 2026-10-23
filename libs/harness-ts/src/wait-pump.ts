/**
 * Virtual-time drain pump for in-process (Solid DOM) harness waits.
 * Advances scheduled work via the Runtime session's underlying scheduler
 * without wall sleep. Isomorphic — no `node:timers`.
 */

import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { WaitPump } from '@pkgs/ui-testing-root-shared-ts/wait';

/** Heap scheduler behind `session.scheduler` (Runtime public API). */
type UnderlyingScheduler = Session['scheduler']['underlying'];

/**
 * Max harness-time advanced per pump tick. Covers upload IDLE_DELAY (100) and one
 * reconcile interval (500) without a wall sleep.
 */
export const HARNESS_WAIT_STEP_MS = 500;

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

/** Macrotask hop after microtasks (Solid effects / MutationObserver deliveries). */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const g = globalThis as typeof globalThis & {
      setImmediate?: (fn: () => void) => unknown;
    };
    if (typeof g.setImmediate === 'function') {
      g.setImmediate(resolve);
      return;
    }
    if (typeof MessageChannel !== 'undefined') {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = () => {
        resolve();
      };
      port2.postMessage(null);
      return;
    }
    queueMicrotask(resolve);
  });
}

/**
 * Serialize overlapping underlying-scheduler `runFor` calls from the UI harness.
 * Nested drain from a scheduled task still throws; concurrent mount / focus /
 * wait-pump callers queue instead of racing the drain gate.
 */
export function createSerializedRunFor(
  scheduler: UnderlyingScheduler,
  opts?: {
    /** Await after each tick (e.g. in-process Hono serializeFetch.drain). */
    readonly after?: () => Promise<void>;
  }
): (durationMs: number) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (durationMs: number): Promise<void> => {
    const run = tail.then(async () => {
      const end = scheduler.clock.now() + Math.max(0, durationMs);
      // A timer callback can start HTTP without returning its promise. Drain
      // that work before advancing to another timer, especially its deadline.
      await settleTick(scheduler, 0, opts?.after);
      while (scheduler.clock.now() < end) {
        const next = scheduler.nextDueAt() ?? end;
        const delta = Math.max(0, Math.min(next, end) - scheduler.clock.now());
        await settleTick(scheduler, delta, opts?.after);
      }
    });
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

async function settleTick(
  scheduler: UnderlyingScheduler,
  durationMs: number,
  after: (() => Promise<void>) | undefined
): Promise<void> {
  await scheduler.runFor(durationMs);
  // Solid effects, MutationObservers and HTTP bodies settle before time moves.
  await flushMicrotasks();
  await yieldEventLoop();
  await after?.();
  // Native response-body reads can finish on the next event-loop turn even
  // after the request handler itself has completed.
  await yieldEventLoop();
  await flushMicrotasks();
}

/**
 * Build a {@link WaitPump} that drains the harness scheduler (due tasks +
 * microtasks) without wall 50ms sleeps.
 */
export function createHarnessWaitPump(args: {
  readonly scheduler: UnderlyingScheduler;
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
      const step = Math.min(delta, HARNESS_WAIT_STEP_MS);
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
