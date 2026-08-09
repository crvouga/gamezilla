import { hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import { assertKvRecord } from './assert-kv-record';
import { KvImplInMemoryTx } from './impl-in-memory-tx';
import type { Kv, KvRecord } from './interface';

export type KvImplInMemoryOptions = {
  /**
   * DST fault knob: when the callback returns an Error, the next enqueued
   * op throws it (then the callback may return null to clear).
   */
  readonly onFault?: () => Error | null | undefined;
};

/**
 * In-memory {@link Kv} for tests and simple single-process use.
 * Serializes all operations through an internal async queue.
 */
export class KvImplInMemory implements Kv {
  private readonly map = new Map<Keyword, KvRecord>();
  private chain: Promise<void> = Promise.resolve();
  private fault: (() => Error | null | undefined) | null;
  private armedFault: Error | null = null;

  constructor(options?: KvImplInMemoryOptions) {
    this.fault = options?.onFault ?? null;
  }

  /** Arm a one-shot transport fault for the next operation (DST). */
  armFault(error: Error): void {
    this.armedFault = error;
  }

  private maybeThrow(): void {
    if (this.armedFault !== null) {
      const err = this.armedFault;
      this.armedFault = null;
      throw err;
    }
    if (this.fault !== null) {
      const err = this.fault();
      if (err != null) throw err;
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      this.maybeThrow();
      return fn();
    });
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    return this.enqueue(async () => {
      const v = this.map.get(key);
      return v !== undefined ? structuredClone(v) : null;
    });
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv in-memory put');
    return this.enqueue(async () => {
      this.map.set(key, structuredClone(value));
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      this.map.delete(key);
    });
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const tx = new KvImplInMemoryTx(this.map);
      return fn(tx);
    });
  }
}

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}
