import { assert } from '../../@shared/assert';
import type { SimEventRecorder } from './event-recorder';
import type { SimLinkScheduler } from './sim-link-scheduler';

export type NetworkOp = 'read' | 'write';

export type NetworkLinkRecordingContext = {
  recorder: SimEventRecorder;
  clientId: string;
};

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

  constructor(
    private readonly scheduler: SimLinkScheduler,
    private readonly recording?: NetworkLinkRecordingContext
  ) {
    assert.defined(scheduler, 'NetworkLink: scheduler required');
  }

  setPartitioned(value: boolean): void {
    const old = this.partitioned;
    this.partitioned = value;
    if (this.recording && old !== value) {
      const { recorder, clientId } = this.recording;
      const t = this.scheduler.now();
      if (value) {
        recorder.emit({ type: 'partition', clientId, time: t });
      } else {
        recorder.emit({ type: 'heal', clientId, time: t });
      }
    }
  }

  isPartitioned(): boolean {
    return this.partitioned;
  }

  getReadWriteLatencyMs(): number {
    return this.readWriteLatencyMs;
  }

  setReadWriteLatencyMs(ms: number): void {
    assert.ok(
      Number.isFinite(ms) && ms >= 0,
      'latency must be finite non-negative',
      {
        ms,
      }
    );
    this.readWriteLatencyMs = ms;
  }

  setInvalidationLatencyMs(ms: number): void {
    assert.ok(
      Number.isFinite(ms) && ms >= 0,
      'latency must be finite non-negative',
      {
        ms,
      }
    );
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
    const clientId = this.recording?.clientId ?? 'unknown';
    const t0 = this.scheduler.now();
    this.recording?.recorder.emit({
      type: 'network_op',
      phase: 'begin',
      clientId,
      op,
      time: t0,
    });
    try {
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
      const result = await fn();
      const t1 = this.scheduler.now();
      this.recording?.recorder.emit({
        type: 'network_op',
        phase: 'end',
        clientId,
        op,
        time: t1,
        ok: true,
        durationMs: t1 - t0,
      });
      return result;
    } catch (err) {
      const t1 = this.scheduler.now();
      const msg = err instanceof Error ? err.message : String(err);
      this.recording?.recorder.emit({
        type: 'network_op',
        phase: 'end',
        clientId,
        op,
        time: t1,
        ok: false,
        durationMs: t1 - t0,
        errorMessage: msg,
      });
      throw err;
    }
  }

  /**
   * Schedule invalidation delivery (e.g. SSE callback). Dropped when partitioned.
   */
  scheduleInvalidation(callback: () => void): void {
    const clientId = this.recording?.clientId ?? 'unknown';
    if (this.partitioned) {
      this.recording?.recorder.emit({
        type: 'invalidation_dropped',
        clientId,
        reason: 'partitioned_at_schedule',
        time: this.scheduler.now(),
      });
      return;
    }
    const invLag = this.invalidationLatencyMs;
    this.recording?.recorder.emit({
      type: 'invalidation_scheduled',
      clientId,
      delayMs: invLag,
      time: this.scheduler.now(),
    });

    const run = (): void => {
      if (this.partitioned) {
        this.recording?.recorder.emit({
          type: 'invalidation_dropped',
          clientId,
          reason: 'partitioned_before_delivery',
          time: this.scheduler.now(),
        });
        return;
      }
      this.recording?.recorder.emit({
        type: 'invalidation_delivered',
        clientId,
        time: this.scheduler.now(),
      });
      callback();
    };

    if (invLag <= 0) {
      this.scheduler.scheduleNow(async () => {
        run();
      });
      return;
    }
    this.scheduler.enqueueAt(this.scheduler.now() + invLag, async () => {
      run();
    });
  }
}
