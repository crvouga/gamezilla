import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useSecureStorage } from './interface';
import type { SecureStorage } from './interface';

/**
 * Reactive view over a single {@link SecureStorage} key.
 *
 * Per-key state lives in module-level maps so:
 *   1. Multiple components reading the same key share one underlying read.
 *   2. Non-React code (e.g. patch-db transport) can read the latest value
 *      synchronously via {@link getCachedSecureStorageValue}.
 *   3. Writes from one consumer are immediately visible to all others.
 */
type Listener = () => void;

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<Listener>>();
const hydrated = new Set<string>();
const hydrating = new Map<string, Promise<string | null>>();

function ensureListeners(key: string): Set<Listener> {
  let set = listeners.get(key);
  if (set === undefined) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (set === undefined) return;
  for (const l of set) l();
}

function setCached(key: string, value: string | null): void {
  cache.set(key, value);
  hydrated.add(key);
  notify(key);
}

async function hydrateOnce(
  storage: SecureStorage,
  key: string
): Promise<string | null> {
  if (hydrated.has(key)) {
    return cache.get(key) ?? null;
  }
  const inflight = hydrating.get(key);
  if (inflight !== undefined) {
    return inflight;
  }
  const promise = storage.getItem(key).then((value) => {
    setCached(key, value);
    hydrating.delete(key);
    return value;
  });
  hydrating.set(key, promise);
  return promise;
}

/**
 * Returns the most recently observed value for `key`, or `null` if the value
 * has not been hydrated yet (or is genuinely absent). Safe to call from non-React
 * code (e.g. patch-db transport getter callbacks).
 */
export function getCachedSecureStorageValue(key: string): string | null {
  return cache.get(key) ?? null;
}

/**
 * Eagerly seeds the module cache for `key` and notifies subscribers. Use this
 * when a sync caller (e.g. a render that just generated a fresh UUID) needs
 * other consumers to see the value before the async storage write completes.
 */
export function seedCachedSecureStorageValue(
  key: string,
  value: string | null
): void {
  setCached(key, value);
}

/** Test-only: clears the module cache between tests. */
export function resetSecureStorageCacheForTest(): void {
  cache.clear();
  hydrated.clear();
  hydrating.clear();
  for (const set of listeners.values()) set.clear();
  listeners.clear();
}

export type UseSecureStorageItemResult = {
  value: string | null;
  setValue: (next: string | null) => Promise<void>;
  isHydrated: boolean;
};

/**
 * Reactive hook over a single secure-storage key. Returns `value` (the latest
 * cached value, `null` until hydrated or genuinely absent), `setValue` (writes
 * through to disk and notifies subscribers), and `isHydrated` (`true` once the
 * initial async read has completed).
 */
export function useSecureStorageItem(key: string): UseSecureStorageItemResult {
  const storage = useSecureStorage();

  const subscribe = useCallback(
    (listener: Listener) => {
      const set = ensureListeners(key);
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(() => cache.get(key) ?? null, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    let cancelled = false;
    void hydrateOnce(storage, key).catch(() => {
      if (cancelled) return;
      // Treat read failure as "absent"; consumers see `null`. We don't crash
      // because secure storage on web reads can throw when localStorage is
      // unavailable (private browsing, etc.).
      setCached(key, null);
    });
    return () => {
      cancelled = true;
    };
  }, [storage, key]);

  const setValue = useCallback(
    async (next: string | null): Promise<void> => {
      if (next === null) {
        await storage.deleteItem(key);
      } else {
        await storage.setItem(key, next);
      }
      setCached(key, next);
    },
    [storage, key]
  );

  return {
    value,
    setValue,
    isHydrated: hydrated.has(key),
  };
}

/**
 * Imperative writer for use from non-React contexts (e.g. inside an effect that
 * already has access to {@link SecureStorage}). Updates the module cache so
 * `useSecureStorageItem` consumers re-render in the same tick.
 */
export async function writeSecureStorageItem(
  storage: SecureStorage,
  key: string,
  value: string | null
): Promise<void> {
  if (value === null) {
    await storage.deleteItem(key);
  } else {
    await storage.setItem(key, value);
  }
  setCached(key, value);
}

/**
 * Suspending variant: throws the hydration promise when the key has not been
 * read yet. Mount inside a `<Suspense>` boundary; consumers that need a value
 * synchronously at render time (e.g. patch-db boot) can call this without
 * a fallback path.
 */
export function useHydratedSecureStorageItem(
  key: string
): UseSecureStorageItemResult {
  const storage = useSecureStorage();
  const result = useSecureStorageItem(key);
  if (!hydrated.has(key)) {
    throw hydrateOnce(storage, key);
  }
  return result;
}
