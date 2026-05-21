import AsyncStorage from '@react-native-async-storage/async-storage';

import { assert, hotAssert } from '@gamezilla/assert';
import type { Keyword } from '@gamezilla/keyword/keyword';
import { assertNamespacedKeyword } from '@gamezilla/keyword/keyword';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}

/** Transaction view: same AsyncStorage; nested {@link Kv.tx} is rejected. */
export class KvImplExpoTx implements Kv {
  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const raw = await AsyncStorage.getItem(key);
    if (raw === null || raw.length === 0) return null;
    return parseKvRecordFromUnknown(hotAssert(), raw, 'kv expo tx get');
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv expo tx put');
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await AsyncStorage.removeItem(key);
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplExpo: nested transaction');
  }
}
