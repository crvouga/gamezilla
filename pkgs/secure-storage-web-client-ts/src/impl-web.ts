import { wrapSecureStorage } from '@pkgs/secure-storage-root-shared-ts/contract';
import type { SecureStorage } from '@pkgs/secure-storage-root-shared-ts/interface';

/**
 * Web `SecureStorage` backed by `localStorage`. Identity and its session
 * survive together across tabs. Wrapped with `wrapSecureStorage` so validation
 * matches the secure-store contract (key charset + 2048-byte value cap) on
 * every call.
 *
 * Neither web store is encrypted; keep this for small identifiers only.
 */
export function createWebSecureStorage(): SecureStorage {
  return persistentStorage('');
}

/**
 * Like {@link createWebSecureStorage}, but every physical key is prefixed with
 * `namespace.` so multiple in-process actors (product-harness Alice/Bob) isolate
 * device ids and similar secrets.
 */
export function createNamespacedWebSecureStorage(
  namespace: string
): SecureStorage {
  return persistentStorage(`${namespace}.`);
}

function persistentStorage(prefix: string): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      assertLocalStorageAvailable();
      const physicalKey = prefix + key;
      const persisted = globalThis.localStorage.getItem(physicalKey);
      if (persisted !== null) return persisted;
      // Move data written by older clients without dropping the tab's account.
      const previous = globalThis.sessionStorage?.getItem(physicalKey) ?? null;
      if (previous !== null) {
        globalThis.localStorage.setItem(physicalKey, previous);
        globalThis.sessionStorage.removeItem(physicalKey);
      }
      return previous;
    },
    async setItem(key: string, value: string): Promise<void> {
      assertLocalStorageAvailable();
      globalThis.localStorage.setItem(prefix + key, value);
      globalThis.sessionStorage?.removeItem(prefix + key);
    },
    async deleteItem(key: string): Promise<void> {
      assertLocalStorageAvailable();
      globalThis.localStorage.removeItem(prefix + key);
      globalThis.sessionStorage?.removeItem(prefix + key);
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

function assertLocalStorageAvailable(): void {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error(
      'localStorage is not available — SecureStorage cannot be used on this platform'
    );
  }
}
