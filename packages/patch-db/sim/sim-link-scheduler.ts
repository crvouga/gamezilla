/**
 * Scheduler contract for {@link NetworkLink}: latency, deferred invalidations, and logical time for recordings.
 */

export interface SimLinkScheduler {
  now(): number;
  delay(ms: number): Promise<void>;
  scheduleNow(run: () => Promise<void>): void;
  enqueueAt(time: number, run: () => Promise<void>): void;
}

/**
 * Wall-clock scheduler for browser playgrounds: {@link Date.now}, `setTimeout` for delays.
 */
export class BrowserWallClockScheduler implements SimLinkScheduler {
  now(): number {
    return Date.now();
  }

  delay(ms: number): Promise<void> {
    assertFiniteDelay(ms);
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  scheduleNow(run: () => Promise<void>): void {
    queueMicrotask(() => {
      void run();
    });
  }

  enqueueAt(time: number, run: () => Promise<void>): void {
    assertFiniteTime(time);
    const d = Math.max(0, time - Date.now());
    setTimeout(() => {
      void run();
    }, d);
  }
}

function assertFiniteTime(t: number): void {
  if (!Number.isFinite(t)) {
    throw new Error(
      `SimLinkScheduler: job time must be finite, got ${String(t)}`
    );
  }
}

function assertFiniteDelay(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(
      `SimLinkScheduler: delay must be finite non-negative, got ${String(ms)}`
    );
  }
}
