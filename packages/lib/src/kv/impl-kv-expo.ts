import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Keyword } from '../keyword/keyword';
import { assertNamespacedKeyword } from '../keyword/keyword';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplExpoTx } from './impl-kv-expo-tx';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

/**
 * Native {@link Kv} backed by `@react-native-async-storage/async-storage`.
 * Operations are serialized through an internal async queue.
 */
export class KvImplExpo implements Kv {
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
      const raw = await AsyncStorage.getItem(key);
      if (raw === null || raw.length === 0) return null;
      return parseKvRecordFromUnknown(raw, 'kv expo get');
    });
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(value, 'kv expo put');
    return this.enqueue(async () => {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      await AsyncStorage.removeItem(key);
    });
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => fn(new KvImplExpoTx()));
  }
}
