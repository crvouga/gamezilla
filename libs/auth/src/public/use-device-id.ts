import {
  createSecureStorageItem,
  useSecureStorageStore,
} from '@pkgs/secure-storage/solid';
import { useCreateId } from '@pkgs/uuid/solid';
import { type Accessor, createComputed } from 'solid-js';
import { DEVICE_ID_KEY } from './auth-storage-keys';
import { isUuid } from './device-id';

/** Empty until storage hydrates; mints at most one id per shared store. */
export function useDeviceId(): Accessor<string> {
  const store = useSecureStorageStore();
  const createId = useCreateId();
  const item = createSecureStorageItem(DEVICE_ID_KEY);
  createComputed(() => {
    if (!item.isHydrated()) return;
    const value = store.getValue(DEVICE_ID_KEY);
    if (value !== null && isUuid(value)) return;
    const id = createId();
    store.setValue(DEVICE_ID_KEY, id);
    void store.write(DEVICE_ID_KEY, id).catch(() => undefined);
  });
  return () => {
    const value = item.value();
    return value !== null && isUuid(value) ? value : '';
  };
}
