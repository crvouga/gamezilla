import { assert } from '../../../assert';
import type { DeterministicScheduler } from './deterministic-scheduler';

export type NetworkOp = 'read' | 'write';

/**
 * One directional "pipe" from a client to a server: latency, partition, and injected failures.
 * Invalidations are delivered on a separate latency track so SSE-style fan-out can be modeled.
 */
export class NetworkLink {
  private partitioned = false;
  private readWriteLatencyMs = 0;
  private invalidationLatencyMs = 0;
  private failNextRead = false;
  private failNextWrite = false;

  constructor(private readonly scheduler: DeterministicScheduler) {
    assert.defined(scheduler, 'NetworkLink: scheduler required');
  }

  setPartitioned(value: boolean): void {
    this.partitioned = value;
  }

  isPartitioned(): boolean {
    return this.partitioned;
  }

  setReadWriteLatencyMs(ms: number): void {
    assert.ok(Number.isFinite(ms) && ms >= 0, 'latency must be finite non-negative', {
      ms,
    });
    this.readWriteLatencyMs = ms;
  }

  setInvalidationLatencyMs(ms: number): void {
    assert.ok(Number.isFinite(ms) && ms >= 0, 'latency must be finite non-negative', {
      ms,
    });
    this.invalidationLatencyMs = ms;
  }

  /** Next read via this link rejects once with `err` (then clears). */
  failNextReadWith(err: unknown): void {
    this.failNextRead = true;
    this._readError = err;
  }

  /** Next write via this link rejects once with `err` (then clears). */
  failNextWriteWith(err: unknown): void {
    this.failNextWrite = true;
    this._writeError = err;
  }

  private _readError: unknown = new Error('simulated read failure');
  private _writeError: unknown = new Error('simulated write failure');

  clearInjectedFailures(): void {
    this.failNextRead = false;
    this.failNextWrite = false;
  }

  blocksInvalidations(): boolean {
    return this.partitioned;
  }

  async invoke<T>(op: NetworkOp, fn: () => Promise<T>): Promise<T> {
    if (this.partitioned) {
      throw new Error(`network partition: blocked ${op}`);
    }
    if (this.readWriteLatencyMs > 0) {
      await this.scheduler.delay(this.readWriteLatencyMs);
    }
    if (op === 'read' && this.failNextRead) {
      this.failNextRead = false;
      const err = this._readError;
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (op === 'write' && this.failNextWrite) {
      this.failNextWrite = false;
      const err = this._writeError;
      throw err instanceof Error ? err : new Error(String(err));
    }
    return fn();
  }

  /**
   * Schedule invalidation delivery (e.g. SSE callback). Dropped when partitioned.
   */
  scheduleInvalidation(callback: () => void): void {
    if (this.partitioned) return;
    const invLag = this.invalidationLatencyMs;
    if (invLag <= 0) {
      this.scheduler.scheduleNow(async () => {
        if (this.partitioned) return;
        callback();
      });
      return;
    }
    this.scheduler.enqueueAt(this.scheduler.now() + invLag, async () => {
      if (this.partitioned) return;
      callback();
    });
  }
}
