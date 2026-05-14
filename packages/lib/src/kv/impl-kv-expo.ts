import AsyncStorage from '@react-native-async-storage/async-storage';

import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import { KvImplExpoTx } from './impl-kv-expo-tx';
import type { Kv } from './interface';

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

  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    return this.enqueue(async () => AsyncStorage.getItem(key));
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      await AsyncStorage.setItem(key, value);
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      await AsyncStorage.removeItem(key);
    });
  }

  async transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () => fn(new KvImplExpoTx()));
  }
}
