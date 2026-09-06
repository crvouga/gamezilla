/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import { type Accessor, type JSX, onCleanup, type ParentProps } from 'solid-js';

import type { SecureStorage } from './interface';
import type { SecureStorageStore } from './secure-storage-store';

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

export type SecureStorageItem = {
  /** Latest store value; `null` until hydrated or genuinely absent. */
  readonly value: Accessor<string | null>;
  /** `true` once the initial async read has completed. */
  readonly isHydrated: Accessor<boolean>;
  /** Writes through to disk and notifies subscribers. */
  readonly setValue: (next: string | null) => Promise<void>;
};

/**
 * Reactive view over a single secure-storage key.
 * Kicks off `hydrate(key)` immediately; a read
 * failure is treated as "absent" so consumers see `null`.
 */
export function createSecureStorageItem(key: string): SecureStorageItem {
  const store = useSecureStorageStore();
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
