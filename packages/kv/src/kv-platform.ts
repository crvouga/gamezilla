import { Platform } from 'react-native';

import type { Keyword } from '@gamezilla/keyword/keyword';
import { KvImplExpo } from './impl-kv-expo';
import { KvImplWeb } from './impl-kv-web';
import type { Kv, KvRecord } from './interface';

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

  get(key: Keyword): Promise<KvRecord | null> {
    return this.inner.get(key);
  }

  put(key: Keyword, value: KvRecord): Promise<void> {
    return this.inner.put(key, value);
  }

  zap(key: Keyword): Promise<void> {
    return this.inner.zap(key);
  }

  tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.inner.tx(fn);
  }
}
