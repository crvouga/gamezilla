import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import type { Kv } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

/** Transaction view: same map, no nested mutex (parent `enqueue` holds the lock). */
export class KvImplInMemoryTx implements Kv {
  constructor(private readonly map: Map<Keyword, string>) {}

  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    return this.map.get(key) ?? null;
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    this.map.set(key, value);
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    this.map.delete(key);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplInMemory: nested transaction');
  }
}
