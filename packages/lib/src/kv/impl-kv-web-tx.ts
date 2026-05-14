import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
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

/** Transaction view: same backing store; nested {@link Kv.transaction} is rejected. */
export class KvImplWebTx implements Kv {
  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    return requireLocalStorage().getItem(key);
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    requireLocalStorage().setItem(key, value);
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    requireLocalStorage().removeItem(key);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplWeb: nested transaction');
  }
}
