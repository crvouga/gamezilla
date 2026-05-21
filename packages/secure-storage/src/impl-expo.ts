import * as SecureStore from 'expo-secure-store';

import { wrapSecureStorage } from './contract';
import type { SecureStorage } from './interface';

/**
 * Native `SecureStorage` backed by `expo-secure-store` (Keychain on iOS,
 * Keystore on Android). Wrapped with `wrapSecureStorage` so the same
 * key/value validation applies to all platforms.
 *
 * Per-value limit is 2048 UTF-8 bytes — keep usage to small secrets
 * (deviceId, session tokens). For bulk blobs use client `Kv` via
 * `KvPlatform` from `@gamezilla/lib/kv/kv-platform`.
 */
export function createExpoSecureStorage(): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      return SecureStore.getItemAsync(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      await SecureStore.setItemAsync(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },
  });
}
