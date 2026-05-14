import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import { KvImplWebTx } from './impl-kv-web-tx';
import type { Kv } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

function requireLocalStorage(): Storage {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error(
      'localStorage is not available — Kv cannot be used on this platform'
    );
  }
  return globalThis.localStorage;
}

/**
 * Web {@link Kv} backed by `localStorage`. Operations are serialized through an
 * internal async queue. {@link Kv.transaction} runs the callback with a nested
 * {@link Kv} that writes to the same store without re-entering the queue.
 */
export class KvImplWeb implements Kv {
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
    return this.enqueue(async () => requireLocalStorage().getItem(key));
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      requireLocalStorage().setItem(key, value);
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      requireLocalStorage().removeItem(key);
    });
  }

  async transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => fn(new KvImplWebTx()));
  }
}
