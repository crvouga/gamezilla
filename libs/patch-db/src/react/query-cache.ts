import { assert } from '@gamezilla/lib/assert';
import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { PatchDbQuery } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import {
  makeEmptyResult,
  resultsShallowEqual,
  reuseStableArrays,
  type CachedQueryResult,
} from './result-equality';

export type { CachedQueryResult } from './result-equality';

type Listener = () => void;

type CacheEntry = {
  queryKey: string;
  query: PatchDbQuery;
  /** Stable result identity; replaced whenever data changes. */
  result: CachedQueryResult;
  /**
   * After the first `subscribe.entities` callback, even an empty read must
   * replace the placeholder snapshot — otherwise it shallow-equals the initial
   * empty result and subscribers would never re-render.
   */
  hasDelivered: boolean;
  listeners: Set<Listener>;
  /** Open underlying subscription handle, or `null` when not yet opened. */
  unsubscribe: Unsubscribe | null;
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

    if (entry.unsubscribe === null) {
      entry.unsubscribe = this.db.subscribe.entities(query, (next) => {
        const prev = entry.result;
        const { entities, patches } = reuseStableArrays(prev, next);
        const nextResult: CachedQueryResult = {
          query: next.query,
          entities,
          patches,
          total: next.total,
          hasMore: next.hasMore,
          nextCursor: next.nextCursor,
        };
        const firstDelivery = !entry.hasDelivered;
        entry.hasDelivered = true;
        if (!firstDelivery && resultsShallowEqual(prev, nextResult)) {
          return;
        }
        entry.result = nextResult;
        for (const l of [...entry.listeners]) l();
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
    return entry?.unsubscribe !== null && entry !== undefined;
  }

  private getOrCreate(queryKey: string, query: PatchDbQuery): CacheEntry {
    const existing = this.entries.get(queryKey);
    if (existing !== undefined) return existing;
    const entry: CacheEntry = {
      queryKey,
      query,
      result: makeEmptyResult(query),
      hasDelivered: false,
      listeners: new Set(),
      unsubscribe: null,
      teardownTimer: null,
    };
    this.entries.set(queryKey, entry);
    return entry;
  }

  private teardown(entry: CacheEntry): void {
    assert.ok(
      entry.listeners.size === 0,
      'teardown called with active listeners',
      { queryKey: entry.queryKey }
    );
    if (entry.unsubscribe !== null) {
      entry.unsubscribe();
      entry.unsubscribe = null;
    }
    entry.teardownTimer = null;
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
