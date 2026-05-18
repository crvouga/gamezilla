import { hotAssert } from '../assert';
import type { Keyword } from '../keyword/keyword';
import { assertNamespacedKeyword } from '../keyword/keyword';
import { assertKvRecord } from './assert-kv-record';
import { KvImplInMemoryTx } from './impl-in-memory-tx';
import type { Kv, KvRecord } from './interface';

/**
 * In-memory {@link Kv} for tests and simple single-process use.
 * Serializes all operations through an internal async queue.
 */
export class KvImplInMemory implements Kv {
  private readonly map = new Map<Keyword, KvRecord>();
  private chain: Promise<void> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
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
