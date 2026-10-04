import { hotAssert } from '@pkgs/assert-shared/hot-asserts';
import { assert } from '@pkgs/assert-shared/singleton';
import type { Keyword } from '@pkgs/keyword-shared/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword-shared/keyword';
import { assertKvRecord } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
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
    assertKvRecord(hotAssert(), value, 'kv in-memory tx put');
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
