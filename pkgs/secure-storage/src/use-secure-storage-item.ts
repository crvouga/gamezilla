import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';

import type { SecureStorageStore } from './secure-storage-store';

const SecureStorageStoreContext = createContext<SecureStorageStore | null>(
  null
);

export const SecureStorageStoreProvider = SecureStorageStoreContext.Provider;

export function useSecureStorageStore(): SecureStorageStore {
  const store = useContext(SecureStorageStoreContext);
  if (store === null) {
    throw new Error(
      'useSecureStorageStore: SecureStorageStoreProvider missing'
    );
  }
  return store;
}

export type UseSecureStorageItemResult = {
  value: string | null;
  setValue: (next: string | null) => Promise<void>;
  isHydrated: boolean;
};

/**
 * Reactive hook over a single secure-storage key. Returns `value` (the latest
 * store value, `null` until hydrated or genuinely absent), `setValue` (writes
 * through to disk and notifies subscribers), and `isHydrated` (`true` once the
 * initial async read has completed).
 *
 * Value and hydration are read inside `useSyncExternalStore` snapshots (not
 * after an epoch-only subscription). Reading `getValue` outside `getSnapshot`
 * could tear under concurrent React and leave `useCurrentAccountId` stuck on
 * `null` after anon ensure had already written the id to the store.
 */
export function useSecureStorageItem(key: string): UseSecureStorageItemResult {
  const store = useSecureStorageStore();

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key]
  );

  const getValueSnapshot = useCallback(() => store.getValue(key), [store, key]);
  const getHydratedSnapshot = useCallback(
    () => store.isHydrated(key),
    [store, key]
  );

  const value = useSyncExternalStore(
    subscribe,
    getValueSnapshot,
    getValueSnapshot
  );
  const isHydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getHydratedSnapshot
  );

  useEffect(() => {
    let cancelled = false;
    void store.hydrate(key).catch(() => {
      if (cancelled) return;
      // Treat read failure as "absent"; consumers see `null`.
      store.setValue(key, null);
    });
    return () => {
      cancelled = true;
    };
  }, [store, key]);

  const setValue = useCallback(
    async (next: string | null): Promise<void> => {
      await store.write(key, next);
    },
    [store, key]
  );

  return {
    value,
    setValue,
    isHydrated,
  };
}

/**
 * Imperative writer for non-React contexts that already hold a
 * {@link SecureStorageStore}. Updates the store mirror before awaiting disk I/O.
 */
export async function writeSecureStorageItem(
  store: SecureStorageStore,
  key: string,
  value: string | null
): Promise<void> {
  await store.write(key, value);
}

/**
 * Suspending variant: throws the hydration promise when the key has not been
 * read yet. Mount inside a `<Suspense>` boundary.
 */
export function useHydratedSecureStorageItem(
  key: string
): UseSecureStorageItemResult {
  const store = useSecureStorageStore();
  const result = useSecureStorageItem(key);
  if (!result.isHydrated) {
    throw store.hydrate(key);
  }
  return result;
}

/** @internal Test seam for the setValue-vs-hydrate race. */
export async function hydrateSecureStorageItemForTest(
  store: SecureStorageStore,
  key: string
): Promise<string | null> {
  return store.hydrate(key);
}
