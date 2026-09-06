// @io-wall-ok
/**
 * Wall browser storage adapter — the only module that touches
 * `navigator.storage.getDirectory()` / `globalThis.caches` for object-store.
 * Composition roots call {@link createBrowserObjectStore}; everything else
 * receives the resulting {@link ObjectStore} by injection.
 */

import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  type CacheStorageLike,
  createCacheApiObjectStore,
} from './impl-cache-api';
import { createOpfsObjectStore } from './impl-opfs';
import type { OpfsDirHandle } from './opfs';

type BrowserStorageGlobals = {
  navigator?: { storage?: { getDirectory?: () => Promise<OpfsDirHandle> } };
  caches?: CacheStorageLike;
};

function browserGlobals(): BrowserStorageGlobals {
  return globalThis as unknown as BrowserStorageGlobals;
}

/** `navigator.storage.getDirectory` bound to the navigator, or `null`. */
export function wallOpfsRoot(): (() => Promise<OpfsDirHandle>) | null {
  const storage = browserGlobals().navigator?.storage;
  const getDirectory = storage?.getDirectory;
  if (storage === undefined || typeof getDirectory !== 'function') return null;
  return () => getDirectory.call(storage);
}

/** `globalThis.caches`, or `null` when the Cache API is unavailable. */
export function wallCacheStorage(): CacheStorageLike | null {
  const caches = browserGlobals().caches;
  if (caches === undefined || typeof caches.open !== 'function') return null;
  return caches;
}

/**
 * Browser {@link ObjectStore}: OPFS when available, Cache API otherwise.
 * Throws when neither storage surface exists (e.g. a non-browser runtime).
 */
export function createBrowserObjectStore(options: {
  readonly baseDir: string;
}): ObjectStore {
  const getRoot = wallOpfsRoot();
  if (getRoot !== null) {
    return createOpfsObjectStore({ baseDir: options.baseDir, getRoot });
  }
  const caches = wallCacheStorage();
  if (caches !== null) {
    return createCacheApiObjectStore({ baseDir: options.baseDir, caches });
  }
  throw new Error(
    'createBrowserObjectStore: neither OPFS nor Cache API is available'
  );
}
