import { assert, hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
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

/** Transaction view: same backing store; nested {@link Kv.tx} is rejected. */
export class KvImplWebTx implements Kv {
  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const raw = requireLocalStorage().getItem(key);
    if (raw === null || raw.length === 0) return null;
    return parseKvRecordFromUnknown(hotAssert(), raw, 'kv web tx get');
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv web tx put');
    requireLocalStorage().setItem(key, JSON.stringify(value));
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    requireLocalStorage().removeItem(key);
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplWeb: nested transaction');
  }
}
