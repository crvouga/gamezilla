import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import { KvImplInMemoryTx } from './impl-in-memory-tx';
import type { Kv } from './interface';

/**
 * In-memory {@link Kv} for tests and simple single-process use.
 * Serializes all operations through an internal async queue.
 */
export class KvImplInMemory implements Kv {
  private readonly map = new Map<Keyword, string>();
  private chain: Promise<void> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    return this.enqueue(async () => this.map.get(key) ?? null);
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      this.map.set(key, value);
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
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

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}
