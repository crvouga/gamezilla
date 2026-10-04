/** @jsxImportSource solid-js */

import type { SecureStorage } from '@pkgs/secure-storage-shared/interface';
import type { SecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { type Accessor, type JSX, onCleanup, type ParentProps } from 'solid-js';

const SecureStorageContext = defineContext<SecureStorage>('SecureStorage');

export type SecureStorageProviderProps = ParentProps<{
  readonly value: SecureStorage;
}>;

export const SecureStorageProvider: (
  props: SecureStorageProviderProps
) => JSX.Element = SecureStorageContext.Provider;

export function useSecureStorage(): SecureStorage {
  return SecureStorageContext.use();
}

export function useSecureStorageOptional(): SecureStorage | undefined {
  return SecureStorageContext.useOptional();
}

const SecureStorageStoreContext =
  defineContext<SecureStorageStore>('SecureStorageStore');

export type SecureStorageStoreProviderProps = ParentProps<{
  readonly value: SecureStorageStore;
}>;

export const SecureStorageStoreProvider: (
  props: SecureStorageStoreProviderProps
) => JSX.Element = SecureStorageStoreContext.Provider;

export function useSecureStorageStore(): SecureStorageStore {
  return SecureStorageStoreContext.use();
}

export function useSecureStorageStoreOptional():
  | SecureStorageStore
  | undefined {
  return SecureStorageStoreContext.useOptional();
}

export type SecureStorageItem = {
  /** Latest store value; `null` until hydrated or genuinely absent. */
  readonly value: Accessor<string | null>;
  /** `true` once the initial async read has completed. */
  readonly isHydrated: Accessor<boolean>;
  /** Writes through to disk and notifies subscribers. */
  readonly setValue: (next: string | null) => Promise<void>;
};

/** Null item shape: no store mounted, so nothing to read or write. */
const NO_STORE_ITEM: SecureStorageItem = {
  value: () => null,
  isHydrated: () => true,
  setValue: () => Promise.resolve(),
};

/**
 * Reactive view over a single secure-storage key, or a no-op item when no
 * `SecureStorageStoreProvider` is mounted (hosts without a persistent store).
 *
 * Hooks are called unconditionally; only the returned handle varies.
 */
export function createSecureStorageItemOptional(
  key: string
): SecureStorageItem {
  const store = useSecureStorageStoreOptional();
  if (store === undefined) return NO_STORE_ITEM;
  return createSecureStorageItemWithStore(key, store);
}

/**
 * Reactive view over a single secure-storage key.
 * Kicks off `hydrate(key)` immediately; a read
 * failure is treated as "absent" so consumers see `null`.
 *
 * Requires a `SecureStorageStoreProvider` above in the tree.
 */
export function createSecureStorageItem(key: string): SecureStorageItem {
  const store = useSecureStorageStore();
  return createSecureStorageItemWithStore(key, store);
}

/** Non-hook half: builds the reactive view over an already-resolved store. */
function createSecureStorageItemWithStore(
  key: string,
  store: SecureStorageStore
): SecureStorageItem {
  const subscribe = (listener: () => void) => store.subscribe(key, listener);
  const value = createSubscriptionSignal({
    getSnapshot: () => store.getValue(key),
    subscribe,
  });
  const isHydrated = createSubscriptionSignal({
    getSnapshot: () => store.isHydrated(key),
    subscribe,
  });

  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });
  void store.hydrate(key).catch(() => {
    if (cancelled) return;
    store.setValue(key, null);
  });

  return {
    value,
    isHydrated,
    setValue: (next) => store.write(key, next),
  };
}
