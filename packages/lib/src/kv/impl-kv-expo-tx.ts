import AsyncStorage from '@react-native-async-storage/async-storage';

import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

/** Transaction view: same AsyncStorage; nested {@link Kv.transaction} is rejected. */
export class KvImplExpoTx implements Kv {
  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const raw = await AsyncStorage.getItem(key);
    if (raw === null || raw.length === 0) return null;
    return parseKvRecordFromUnknown(raw, 'kv expo tx get');
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(value, 'kv expo tx put');
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await AsyncStorage.removeItem(key);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplExpo: nested transaction');
  }
}
