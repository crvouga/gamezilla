import { assert } from '../assert';
import type { Keyword } from '../keyword/keyword';
import { assertNamespacedKeyword } from '../keyword/keyword';
import { assertKvRecord } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

/** Transaction view: same map, no nested mutex (parent `enqueue` holds the lock). */
export class KvImplInMemoryTx implements Kv {
  constructor(private readonly map: Map<Keyword, KvRecord>) {}

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const v = this.map.get(key);
    return v !== undefined ? structuredClone(v) : null;
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(value, 'kv in-memory tx put');
    this.map.set(key, structuredClone(value));
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    this.map.delete(key);
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplInMemory: nested transaction');
  }
}
