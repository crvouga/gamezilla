import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import {
  createSecureStorageItem,
  useSecureStorageStore,
} from '@pkgs/secure-storage-root-client-ts/solid';
import type { SecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { isUuid } from '@pkgs/uuid-shared-ts/uuid';
import { type Accessor, createEffect, createMemo } from 'solid-js';

/** The id minted for each store that had none, so every reader names one. */
const mintedIds = new WeakMap<SecureStorageStore, string>();

function mintedIdFor(store: SecureStorageStore, createId: () => string) {
  const existing = mintedIds.get(store);
  if (existing !== undefined) return existing;
  const id = createId();
  mintedIds.set(store, id);
  return id;
}

/** Empty until storage hydrates; mints at most one id per shared store. */
export function useDeviceId(): Accessor<string> {
  const store = useSecureStorageStore();
  const createId = useCreateId();
  const item = createSecureStorageItem(DEVICE_ID_KEY);
  // A hydrated store without an id has one from this moment: whatever reads
  // the id as hydration shows already sees it. Saving it follows below.
  const deviceId = createMemo(() => {
    const value = item.value();
    if (value !== null && isUuid(value)) return value;
    return item.isHydrated() ? mintedIdFor(store, createId) : '';
  });
  createEffect(
    () => deviceId(),
    (id) => {
      if (id.length === 0 || store.getValue(DEVICE_ID_KEY) === id) return;
      store.setValue(DEVICE_ID_KEY, id);
      void store.write(DEVICE_ID_KEY, id).catch(() => undefined);
    }
  );
  return deviceId;
}
