/**
 * `AuthClientStorage` (bearer-token persistence for `@pkgs/auth-inhouse`) over the
 * app's `SecureStorageStore`: sync reads hit the in-memory mirror, async
 * reads / writes go through the store so the bearer key stays visible to
 * every secure-storage reader in the tree.
 */

import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import {
  type AuthClientStorage,
  type BearerTokenStore,
  createBearerTokenStore,
} from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import type { SecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';

/**
 * Where the app keeps its bearer token (`<namespace>.auth.bearer`). It derives
 * from the immutable namespace: changing it would sign every device out.
 */
export const AUTH_BEARER_STORAGE_KEY = technicalKey('auth.bearer');

/** The app's bearer token, kept in `storage` under {@link AUTH_BEARER_STORAGE_KEY}. */
export function createAppBearerTokenStore(
  storage: AuthClientStorage
): BearerTokenStore {
  return createBearerTokenStore({
    storage,
    storageKey: AUTH_BEARER_STORAGE_KEY,
  });
}

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
