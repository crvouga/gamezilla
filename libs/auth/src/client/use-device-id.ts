import { useSecureStorage } from '@pkgs/secure-storage/interface';
import {
  getCachedSecureStorageValue,
  seedCachedSecureStorageValue,
  useHydratedSecureStorageItem,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { useEffect, useRef } from 'react';

import { assertDeviceId, isUuid } from '../shared/device-id';
import { DEVICE_ID_KEY } from './auth-storage-keys';

/**
 * Reactive accessor for the per-install device UUID. Suspends until the
 * secure-storage cache has been read at least once. If the cached value is
 * absent or invalid, a fresh UUID is generated, seeded into the module cache,
 * and persisted asynchronously — the very first render returns the new id.
 *
 * Must be called inside a `<Suspense>` boundary (the app root supplies one).
 */
export function useDeviceId(): string {
  const storage = useSecureStorage();
  const { value } = useHydratedSecureStorageItem(DEVICE_ID_KEY);
  const generatedRef = useRef<string | null>(null);

  let resolved: string;
  if (typeof value === 'string' && isUuid(value)) {
    resolved = value;
  } else {
    if (generatedRef.current === null) {
      generatedRef.current = globalThis.crypto.randomUUID();
      // Seed the module cache synchronously so non-React readers
      // (`getCachedDeviceId` / sync transport) see the same id this
      // render returned.
      seedCachedSecureStorageValue(DEVICE_ID_KEY, generatedRef.current);
    }
    resolved = generatedRef.current;
  }

  useEffect(() => {
    void writeSecureStorageItem(storage, DEVICE_ID_KEY, resolved).catch(
      () => undefined
    );
  }, [storage, resolved]);

  return resolved;
}

/**
 * Synchronous access to the cached device id for non-React code (e.g. the
 * sync transport's `getAnonId` callback). Returns `null` until the
 * reactive hook has hydrated the value at least once.
 */
export function getCachedDeviceId(): string | null {
  const raw = getCachedSecureStorageValue(DEVICE_ID_KEY);
  if (typeof raw === 'string' && isUuid(raw)) return raw;
  return null;
}

/** Crashing variant: throws if `useDeviceId` ever observed a non-UUID value. */
export function assertCachedDeviceId(): string {
  const id = getCachedDeviceId();
  assertDeviceId(id);
  return id;
}
