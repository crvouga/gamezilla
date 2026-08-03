import type { Sql } from '@pkgs/sql';
import type { WatchSubscription } from './sync-engine-port';
import { watchQueryCacheKey } from './watch-query-cache';

/**
 * Port-level handle for a single watched SQL query.
 * Implementations must be event-driven (no polling).
 */
export type WatchSqlHandle<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  getSnapshot(): readonly T[];
  getHydrated(): boolean;
  subscribe(listener: () => void): () => void;
  close(): void;
};

type RegistryEntry = {
  readonly handle: WatchSqlHandle;
  readonly listeners: Set<() => void>;
  disposeHandleSub: () => void;
  refCount: number;
};

type OpenWatchSql = (query: Sql<Record<string, unknown>>) => WatchSqlHandle;

function getOrCreateEntry(
  entries: Map<string, RegistryEntry>,
  open: OpenWatchSql,
  query: Sql<Record<string, unknown>>
): RegistryEntry {
  const key = watchQueryCacheKey(query.sql, JSON.stringify(query.values));
  const existing = entries.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const handle = open(query);
  const listeners = new Set<() => void>();
  const entry: RegistryEntry = {
    handle,
    listeners,
    refCount: 0,
    disposeHandleSub: handle.subscribe(() => {
      for (const listener of listeners) {
        listener();
      }
    }),
  };
  entries.set(key, entry);
  return entry;
}

function createWatchSubscription<T extends Record<string, unknown>>(
  entries: Map<string, RegistryEntry>,
  open: OpenWatchSql,
  query: Sql<T>
): WatchSubscription<readonly T[]> {
  const key = watchQueryCacheKey(query.sql, JSON.stringify(query.values));
  let cachedSnapshot: readonly T[] = [];
  let cachedHydrated = false;

  const syncCacheFromEntry = (): void => {
    const entry = entries.get(key);
    if (entry === undefined) return;
    cachedSnapshot = entry.handle.getSnapshot() as readonly T[];
    cachedHydrated = entry.handle.getHydrated();
  };

  return {
    getSnapshot: () => {
      syncCacheFromEntry();
      return cachedSnapshot;
    },
    getHydrated: () => {
      syncCacheFromEntry();
      return cachedHydrated;
    },
    subscribe: (listener) => {
      const entry = getOrCreateEntry(entries, open, query);
      entry.refCount += 1;
      const wrapped = (): void => {
        syncCacheFromEntry();
        listener();
      };
      entry.listeners.add(wrapped);
      // Do not call listener synchronously — useSyncExternalStore forbids it
      // and an unstable handle snapshot would infinite-loop via forceStoreRerender.
      return () => {
        entry.listeners.delete(wrapped);
        entry.refCount -= 1;
        if (entry.refCount <= 0) {
          syncCacheFromEntry();
          entry.disposeHandleSub();
          entry.handle.close();
          entries.delete(key);
        }
      };
    },
  };
}

/**
 * Refcounted watch sharing: identical `(sql, values)` share one underlying
 * {@link WatchSqlHandle}. Last unsubscribe closes the handle.
 */
export function createSharedWatchRegistry(open: OpenWatchSql): {
  watch<T extends Record<string, unknown>>(
    query: Sql<T>
  ): WatchSubscription<readonly T[]>;
} {
  const entries = new Map<string, RegistryEntry>();
  return {
    watch<T extends Record<string, unknown>>(
      query: Sql<T>
    ): WatchSubscription<readonly T[]> {
      return createWatchSubscription(entries, open, query);
    },
  };
}
