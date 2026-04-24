import { wrapSecureStorage } from '@gamezilla/lib/secure-storage';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

export function createWebSecureStorage(): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — principalId cannot be persisted on this platform'
        );
      }
      return globalThis.localStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — principalId cannot be persisted on this platform'
        );
      }
      globalThis.localStorage.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — principalId cannot be persisted on this platform'
        );
      }
      globalThis.localStorage.removeItem(key);
    },
  });
}
