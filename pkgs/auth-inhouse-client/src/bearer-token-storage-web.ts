import {
  type AuthClientStorage,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth-inhouse-shared/bearer-token-store';

/**
 * Web {@link AuthClientStorage} that prefixes every key with `namespace.` in
 * `localStorage` so multiple in-process actors do not share bearer tokens.
 */
export function createNamespacedAuthClientStorage(
  namespace: string
): AuthClientStorage {
  const prefix = `${namespace}.`;
  if (typeof globalThis.localStorage === 'undefined') {
    return createInMemoryAuthClientStorage();
  }
  const store = globalThis.localStorage;
  return {
    getItem: (key) => store.getItem(prefix + key),
    setItem: (key, value) => {
      store.setItem(prefix + key, value);
    },
    removeItem: (key) => {
      store.removeItem(prefix + key);
    },
  };
}

/** Removes every `localStorage` key that starts with `namespace.`. */
export function clearNamespacedAuthClientStorage(namespace: string): void {
  const storage = globalThis.localStorage;
  if (storage === undefined) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(`${namespace}.`)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}
