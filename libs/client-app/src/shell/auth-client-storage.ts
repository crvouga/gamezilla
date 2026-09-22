/**
 * `AuthClientStorage` (bearer-token persistence for `@pkgs/auth-inhouse`) over the
 * app's `SecureStorageStore`: sync reads hit the in-memory mirror, async
 * reads / writes go through the store so the bearer key stays visible to
 * every secure-storage reader in the tree.
 */

import type { AuthClientStorage } from '@pkgs/auth-inhouse/client';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';

export function createSecureStoreAuthClientStorage(
  store: SecureStorageStore
): AuthClientStorage {
  return {
    getItem: (key) => store.getValue(key),
    setItem: (key, value) => {
      void store.write(key, value).catch(() => undefined);
    },
    removeItem: (key) => {
      void store.write(key, null).catch(() => undefined);
    },
    getItemAsync: (key) => store.hydrate(key),
    setItemAsync: (key, value) => store.write(key, value),
    deleteItemAsync: (key) => store.write(key, null),
  };
}
