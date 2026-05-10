import { assert } from '../assert';
import type { Kv } from './interface';

function assertNonEmptyKey(key: string): void {
  assert.ok(
    typeof key === 'string' && key.length > 0,
    'Kv: key must be non-empty string',
    { key }
  );
}

/** Transaction view: same map, no nested mutex (parent `enqueue` holds the lock). */
export class KvImplInMemoryTx implements Kv {
  constructor(private readonly map: Map<string, string>) {}

  async get(key: string): Promise<string | null> {
    assertNonEmptyKey(key);
    return this.map.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    assertNonEmptyKey(key);
    this.map.set(key, value);
  }

  async zap(key: string): Promise<void> {
    assertNonEmptyKey(key);
    this.map.delete(key);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplInMemory: nested transaction');
  }
}
