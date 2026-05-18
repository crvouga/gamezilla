import { hotAssert } from '../assert';
import type { Keyword } from '../keyword/keyword';
import { assertNamespacedKeyword } from '../keyword/keyword';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplWebTx } from './impl-kv-web-tx';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
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
 * internal async queue. {@link Kv.tx} runs the callback with a nested
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

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    return this.enqueue(async () => {
      const raw = requireLocalStorage().getItem(key);
      if (raw === null || raw.length === 0) return null;
      return parseKvRecordFromUnknown(hotAssert(), raw, 'kv web get');
    });
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv web put');
    return this.enqueue(async () => {
      requireLocalStorage().setItem(key, JSON.stringify(value));
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      requireLocalStorage().removeItem(key);
    });
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => fn(new KvImplWebTx()));
  }
}
