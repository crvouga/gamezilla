import { Platform } from 'react-native';

import { KvImplExpo } from './impl-kv-expo';
import { KvImplWeb } from './impl-kv-web';
import type { Kv } from './interface';
import type { Keyword } from '../keyword/keyword';

/**
 * Platform-specific {@link Kv} for the client app shell:
 * - web: `localStorage`
 * - native: `@react-native-async-storage/async-storage`
 *
 * For small encrypted-at-rest secrets use `createSecureStorage` instead —
 * expo-secure-store is unsuitable for large room cache blobs.
 */
export class KvPlatform implements Kv {
  private readonly inner: Kv;

  constructor() {
    this.inner = Platform.OS === 'web' ? new KvImplWeb() : new KvImplExpo();
  }

  get(key: Keyword): Promise<string | null> {
    return this.inner.get(key);
  }

  put(key: Keyword, value: string): Promise<void> {
    return this.inner.put(key, value);
  }

  zap(key: Keyword): Promise<void> {
    return this.inner.zap(key);
  }

  transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.inner.transaction(fn);
  }
}
