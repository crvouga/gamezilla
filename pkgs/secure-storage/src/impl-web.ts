import { wrapSecureStorage } from './contract';
import type { SecureStorage } from './interface';

/**
 * Web keys that must stay tab-scoped (not shared across browser tabs).
 * Everything else uses `localStorage` for cross-tab availability.
 */
const SESSION_SCOPED_KEYS = new Set(['lastLocalAccountId']);

/**
 * Web `SecureStorage` backed by `localStorage` (or `sessionStorage` for
 * tab-scoped keys). Wrapped with `wrapSecureStorage` so key/value validation
 * matches expo-secure-store (key charset + 2048-byte value cap) on every call.
 *
 * Neither web store is encrypted; keep this for small identifiers only.
 */
export function createWebSecureStorage(): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      return webStore(key).getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      webStore(key).setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      webStore(key).removeItem(key);
    },
  });
}

function webStore(key: string): Storage {
  if (SESSION_SCOPED_KEYS.has(key)) {
    assertSessionStorageAvailable();
    return globalThis.sessionStorage;
  }
  assertLocalStorageAvailable();
  return globalThis.localStorage;
}

function assertLocalStorageAvailable(): void {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error(
      'localStorage is not available — SecureStorage cannot be used on this platform'
    );
  }
}

function assertSessionStorageAvailable(): void {
  if (typeof globalThis.sessionStorage === 'undefined') {
    throw new Error(
      'sessionStorage is not available — SecureStorage cannot be used on this platform'
    );
  }
}
