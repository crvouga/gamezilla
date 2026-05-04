import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';

/**
 * Web `KeyValueStorage` backed by `localStorage`. Per-key size is bounded
 * only by the browser's overall localStorage quota (~5MB).
 */
export function createWebKeyValueStorage(): KeyValueStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — KeyValueStorage cannot be used on this platform'
        );
      }
      return globalThis.localStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — KeyValueStorage cannot be used on this platform'
        );
      }
      globalThis.localStorage.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      if (typeof globalThis.localStorage === 'undefined') {
        throw new Error(
          'localStorage is not available — KeyValueStorage cannot be used on this platform'
        );
      }
      globalThis.localStorage.removeItem(key);
    },
  };
}
