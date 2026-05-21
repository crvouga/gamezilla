import { wrapSecureStorage } from './contract';
import type { SecureStorage } from './interface';

/**
 * Web `SecureStorage` backed by `localStorage`. Wrapped with
 * `wrapSecureStorage` so key/value validation matches expo-secure-store
 * (key charset + 2048-byte value cap) on every call.
 *
 * `localStorage` is **not encrypted**; on web we trade the at-rest guarantee
 * for cross-tab availability. Keep this for small identifiers (deviceId,
 * session tokens) only — never use it for bulk cache blobs.
 */
export function createWebSecureStorage(): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      assertLocalStorageAvailable();
      return globalThis.localStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      assertLocalStorageAvailable();
      globalThis.localStorage.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      assertLocalStorageAvailable();
      globalThis.localStorage.removeItem(key);
    },
  });
}

function assertLocalStorageAvailable(): void {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error(
      'localStorage is not available — SecureStorage cannot be used on this platform'
    );
  }
}
