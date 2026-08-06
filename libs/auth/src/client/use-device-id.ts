import {
  useHydratedSecureStorageItem,
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { useEffect, useRef } from 'react';

import { isUuid } from '../shared/device-id';
import { DEVICE_ID_KEY } from './auth-storage-keys';

/**
 * Reactive accessor for the per-install device UUID. Suspends until the
 * secure-storage key has been read at least once. If the value is absent or
 * invalid, a fresh UUID is generated, written into the store, and persisted
 * asynchronously — the very first render returns the new id.
 *
 * Must be called inside a `<Suspense>` boundary (the app root supplies one).
 */
export function useDeviceId(): string {
  const store = useSecureStorageStore();
  const { value } = useHydratedSecureStorageItem(DEVICE_ID_KEY);
  const generatedRef = useRef<string | null>(null);

  let resolved: string;
  if (typeof value === 'string' && isUuid(value)) {
    resolved = value;
  } else {
    if (generatedRef.current === null) {
      generatedRef.current = globalThis.crypto.randomUUID();
      // Update the store synchronously so other React readers see this id
      // before the async persist completes.
      store.setValue(DEVICE_ID_KEY, generatedRef.current);
    }
    resolved = generatedRef.current;
  }

  useEffect(() => {
    void writeSecureStorageItem(store, DEVICE_ID_KEY, resolved).catch(
      () => undefined
    );
  }, [store, resolved]);

  return resolved;
}
