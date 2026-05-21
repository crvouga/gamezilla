import { assert } from '@pkgs/assert';
import type { Unsubscribe } from '@pkgs/pub-sub/interface';
import type { PatchDbQuery } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import {
  resultsShallowEqual,
  reuseStableArrays,
  type CachedQueryResult,
} from './result-equality';
import { evaluateQuery } from './sync-query-eval';
import { getInMemoryStoreForDb } from './in-memory-store-registry';

export type { CachedQueryResult } from './result-equality';

type Listener = () => void;

type CacheEntry = {
  queryKey: string;
  query: PatchDbQuery;
  /** Stable result identity; replaced whenever data changes. */
  result: CachedQueryResult;
  listeners: Set<Listener>;
  /**
   * Registers this query with {@link SubscribablePatchDbLike.subscribe.entities}
   * (e.g. {@link SyncPatchDb} active queries) so remote poll can fetch rows
   * into local SQLite; UI still reads via the in-memory store + invalidation.
   */
  syncEntitiesUnsub: Unsubscribe | null;
  /**
   * Pending teardown handle (opaque, scheduler-defined) set when refCount
   * drops to zero. Cancelled when a new subscriber re-attaches inside the
   * grace window so route flips and conditional renders don't tear down a
   * query that is about to be re-asked.
   */
  teardownTimer: unknown | null;
};

/** Grace window before a query with no listeners is fully torn down. */
export const DEFAULT_TEARDOWN_GRACE_MS = 10_000;

export type PatchDbQueryCacheOptions = {
  /** Override the grace window. Tests use a small value to assert teardown. */
  teardownGraceMs?: number;
  /** Injectable scheduler for tests; defaults to setTimeout/clearTimeout. */
  scheduler?: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
};

/**
 * Module-level cache that fans subscribers in over a single underlying
 * `db.subscribe.entities` per queryKey, retains snapshots across short
 * unmount/remount cycles, and serves cached snapshots synchronously to new
 * subscribers so React consumers immediately see the last-known or empty
 * snapshot for that queryKey.
 */
export class PatchDbQueryCache {
  private entries = new Map<string, CacheEntry>();
  private graceMs: number;
  private scheduler: NonNullable<PatchDbQueryCacheOptions['scheduler']>;
  private storeUnsub: Unsubscribe | null = null;

  constructor(
    private readonly db: SubscribablePatchDbLike,
    options: PatchDbQueryCacheOptions = {}
  ) {
    this.graceMs = options.teardownGraceMs ?? DEFAULT_TEARDOWN_GRACE_MS;
    this.scheduler = options.scheduler ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
  }

  /**
   * Subscribe to the cached snapshot for `queryKey`. The first subscriber for
   * a key opens the underlying subscription; later subscribers attach in O(1)
   * and immediately observe the existing snapshot via `getResult`.
   */
  subscribe(
    queryKey: string,
    query: PatchDbQuery,
    listener: Listener
  ): Unsubscribe {
    const entry = this.getOrCreate(queryKey, query);

    if (entry.teardownTimer !== null) {
      this.scheduler.clearTimeout(entry.teardownTimer);
      entry.teardownTimer = null;
    }

    entry.listeners.add(listener);

    if (entry.syncEntitiesUnsub === null) {
      entry.syncEntitiesUnsub = this.db.subscribe.entities(query, () => {
        /* Sync layer drives local SQLite + hydrate; cache reacts via store. */
      });
    }

    if (this.storeUnsub === null) {
      const store = getInMemoryStoreForDb(this.db);
      this.storeUnsub = store.subscribe((touched) => {
        this.onStoreChanged(touched);
      });
    }

    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) {
        if (entry.teardownTimer !== null) {
          this.scheduler.clearTimeout(entry.teardownTimer);
        }
        entry.teardownTimer = this.scheduler.setTimeout(() => {
          this.teardown(entry);
        }, this.graceMs);
      }
    };
  }

  /** Returns the stable snapshot for `queryKey`, or `null` if no entry exists. */
  getResult(queryKey: string): CachedQueryResult | null {
    return this.entries.get(queryKey)?.result ?? null;
  }

  /**
   * Returns a stable snapshot for `queryKey`, materializing an empty entry if
   * none exists yet. Callers (e.g. `useSyncExternalStore.getSnapshot`) require
   * referential stability across calls, so we never return fresh objects.
   */
  getOrCreateResult(queryKey: string, query: PatchDbQuery): CachedQueryResult {
    return this.getOrCreate(queryKey, query).result;
  }

  /** Test helper: number of live cache entries. */
  size(): number {
    return this.entries.size;
  }

  /** Test helper: whether `queryKey` has an open underlying subscription. */
  isOpen(queryKey: string): boolean {
    const entry = this.entries.get(queryKey);
    return entry !== undefined && this.storeUnsub !== null;
  }

  /**
   * Immediately tears down every cache entry (subscriptions + timers), even if
   * listeners are still registered. Used when swapping the underlying SQLite
   * file so no stale snapshots reference a closed DB.
   */
  forceDetachAll(): void {
    if (this.storeUnsub !== null) {
      this.storeUnsub();
      this.storeUnsub = null;
    }
    for (const entry of this.entries.values()) {
      if (entry.teardownTimer !== null) {
        this.scheduler.clearTimeout(entry.teardownTimer);
        entry.teardownTimer = null;
      }
      entry.syncEntitiesUnsub?.();
      entry.syncEntitiesUnsub = null;
      entry.listeners.clear();
    }
    this.entries.clear();
  }

  private getOrCreate(queryKey: string, query: PatchDbQuery): CacheEntry {
    const existing = this.entries.get(queryKey);
    if (existing !== undefined) return existing;
    const store = getInMemoryStoreForDb(this.db);
    const evaluated = evaluateQuery(query, store);
    const entry: CacheEntry = {
      queryKey,
      query,
      result: {
        ...evaluated,
        isLoading: false,
      },
      listeners: new Set(),
      syncEntitiesUnsub: null,
      teardownTimer: null,
    };
    this.entries.set(queryKey, entry);
    return entry;
  }

  private onStoreChanged(touched: ReadonlySet<string>): void {
    const store = getInMemoryStoreForDb(this.db);
    const touchedArray = touched.size > 0 ? Array.from(touched) : null;
    for (const entry of this.entries.values()) {
      if (entry.listeners.size === 0) continue;
      if (
        touchedArray !== null &&
        this.shouldSkipEntry(entry.query, touchedArray)
      ) {
        continue;
      }
      const next = evaluateQuery(entry.query, store);
      const prev = entry.result;
      const { entities, patches } = reuseStableArrays(prev, next);
      const nextResult: CachedQueryResult = {
        query: next.query,
        entities,
        patches,
        total: next.total,
        hasMore: next.hasMore,
        nextCursor: next.nextCursor,
        isLoading: false,
      };
      if (resultsShallowEqual(prev, nextResult)) continue;
      entry.result = nextResult;
      for (const l of [...entry.listeners]) l();
    }
  }

  private shouldSkipEntry(
    query: PatchDbQuery,
    touched: readonly string[]
  ): boolean {
    // If a query does not restrict entityType, any touched entity could affect it.
    if (
      query.entityType === undefined ||
      query.entityType === null ||
      query.entityType === ''
    ) {
      return false;
    }
    // If entityId is a single string, only re-eval when that exact key is touched.
    if (typeof query.entityId === 'string') {
      const key = `${query.entityType}\0${query.entityId}`;
      return !touched.includes(key);
    }
    // Otherwise re-eval when any entity of that type is touched.
    const prefix = `${query.entityType}\0`;
    return !touched.some((k) => k.startsWith(prefix));
  }

  private teardown(entry: CacheEntry): void {
    assert.ok(
      entry.listeners.size === 0,
      'teardown called with active listeners',
      { queryKey: entry.queryKey }
    );
    entry.teardownTimer = null;
    entry.syncEntitiesUnsub?.();
    entry.syncEntitiesUnsub = null;
    this.entries.delete(entry.queryKey);
  }
}

const cacheByDb = new WeakMap<SubscribablePatchDbLike, PatchDbQueryCache>();

/**
 * Returns the singleton `PatchDbQueryCache` for `db`. Creating one cache per
 * db keeps subscribers from different containers isolated, while letting
 * every consumer of the same db share snapshots.
 */
export function getCacheForDb(db: SubscribablePatchDbLike): PatchDbQueryCache {
  const existing = cacheByDb.get(db);
  if (existing !== undefined) return existing;
  const created = new PatchDbQueryCache(db);
  cacheByDb.set(db, created);
  return created;
}

/**
 * Detaches all patch-db React query subscriptions for `db` (if a cache exists).
 * Call before destroying the sync patch-db layer / closing SQLite when swapping account DBs.
 */
export function forceDetachPatchDbQuerySubscriptionsForDb(
  db: SubscribablePatchDbLike
): void {
  const cache = cacheByDb.get(db);
  if (cache === undefined) return;
  cache.forceDetachAll();
  cacheByDb.delete(db);
}
