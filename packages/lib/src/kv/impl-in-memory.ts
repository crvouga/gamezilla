import { assert } from '../assert';
import { KvImplInMemoryTx } from './impl-in-memory-tx';
import type { Kv } from './interface';

/**
 * In-memory {@link Kv} for tests and simple single-process use.
 * Serializes all operations through an internal async queue.
 */
export class KvImplInMemory implements Kv {
  private readonly map = new Map<string, string>();
  private chain: Promise<void> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async get(key: string): Promise<string | null> {
    assertNonEmptyKey(key);
    return this.enqueue(async () => this.map.get(key) ?? null);
  }

  async put(key: string, value: string): Promise<void> {
    assertNonEmptyKey(key);
    return this.enqueue(async () => {
      this.map.set(key, value);
    });
  }

  async zap(key: string): Promise<void> {
    assertNonEmptyKey(key);
    return this.enqueue(async () => {
      this.map.delete(key);
    });
  }

  async transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const tx = new KvImplInMemoryTx(this.map);
      return fn(tx);
    });
  }
}

function assertNonEmptyKey(key: string): void {
  assert.ok(
    typeof key === 'string' && key.length > 0,
    'Kv: key must be non-empty string',
    { key }
  );
}
