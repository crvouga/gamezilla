/**
 * Single-threaded logical clock + priority queue for deterministic async-ish ordering.
 * Jobs are ordered by `(time, seq)` where `seq` breaks ties stably.
 */

import { assert } from '@gamezilla/shared/assert';
import type { SimLinkScheduler } from './sim-link-scheduler';

type Job = {
  time: number;
  seq: number;
  run: () => Promise<void>;
};

export class DeterministicScheduler implements SimLinkScheduler {
  private time = 0;
  private seq = 0;
  private readonly heap: Job[] = [];

  /** Current logical time in ms (last completed job's scheduled time). */
  now(): number {
    return this.time;
  }

  private sortHeap(): void {
    this.heap.sort((a, b) => a.time - b.time || a.seq - b.seq);
  }

  /**
   * Resolves after `ms` logical ms elapse (when this job is processed).
   * The delay is measured from the scheduler time at the moment `delay()` is called.
   */
  delay(ms: number): Promise<void> {
    const start = this.time;
    return new Promise((resolve) => {
      this.enqueueAt(start + ms, async () => {
        resolve();
      });
    });
  }

  enqueueAt(time: number, run: () => Promise<void>): void {
    this.heap.push({ time, seq: this.seq++, run });
    this.sortHeap();
  }

  /** Run ASAP at the current clock (still behind any already-scheduled earlier jobs). */
  scheduleNow(run: () => Promise<void>): void {
    this.enqueueAt(this.time, run);
  }

  /** Run the next due job, if any. */
  async tick(): Promise<boolean> {
    if (this.heap.length === 0) return false;
    const job = this.heap.shift();
    assert.defined(job, 'job must be defined');
    assertFiniteTime(job.time);
    this.time = job.time;
    await job.run();
    return true;
  }

  /** Drain until no jobs remain (handles jobs enqueued during execution). */
  async drain(): Promise<void> {
    while (await this.tick()) {
      // keep going
    }
  }

  /** How many jobs are queued. */
  pendingCount(): number {
    return this.heap.length;
  }
}

function assertFiniteTime(t: number): void {
  if (!Number.isFinite(t)) {
    throw new Error(
      `DeterministicScheduler: job time must be finite, got ${String(t)}`
    );
  }
}
