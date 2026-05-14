import AsyncStorage from '@react-native-async-storage/async-storage';

import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import type { Kv } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

/** Transaction view: same AsyncStorage; nested {@link Kv.transaction} is rejected. */
export class KvImplExpoTx implements Kv {
  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    return AsyncStorage.getItem(key);
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    await AsyncStorage.setItem(key, value);
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await AsyncStorage.removeItem(key);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplExpo: nested transaction');
  }
}
