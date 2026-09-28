import { wrapSecureStorage } from '@pkgs/secure-storage/contract';
import type { SecureStorage } from '@pkgs/secure-storage/interface';

/**
 * Web keys that must stay tab-scoped (not shared across browser tabs).
 * Everything else uses `localStorage` for cross-tab availability.
 */
const SESSION_SCOPED_KEYS = new Set(['lastLocalAccountId']);

/**
 * Web `SecureStorage` backed by `localStorage` (or `sessionStorage` for
 * tab-scoped keys). Wrapped with `wrapSecureStorage` so key/value validation
 * matches the secure-store contract (key charset + 2048-byte value cap) on
 * every call.
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

/**
 * Like {@link createWebSecureStorage}, but every physical key is prefixed with
 * `namespace.` so multiple in-process actors (product-harness Alice/Bob) isolate
 * device ids and similar secrets.
 */
export function createNamespacedWebSecureStorage(
  namespace: string
): SecureStorage {
  const prefix = `${namespace}.`;
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      return webStore(key).getItem(prefix + key);
    },
    async setItem(key: string, value: string): Promise<void> {
      webStore(key).setItem(prefix + key, value);
    },
    async deleteItem(key: string): Promise<void> {
      webStore(key).removeItem(prefix + key);
    },
  });
}

/** Removes every localStorage / sessionStorage key that starts with `namespace.`. */
export function clearNamespacedWebSecureStorage(namespace: string): void {
  const prefix = `${namespace}.`;
  clearStorageKeysWithPrefix(globalThis.localStorage, prefix);
  clearStorageKeysWithPrefix(globalThis.sessionStorage, prefix);
}

function clearStorageKeysWithPrefix(
  storage: Storage | undefined,
  prefix: string
): void {
  if (storage === undefined) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
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
