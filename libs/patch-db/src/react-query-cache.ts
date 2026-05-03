import { assert } from '@gamezilla/lib/assert';
import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type {
  Entity,
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
} from './interface';
import type { SubscribablePatchesDbLike } from './subscribable';

/**
 * Snapshot returned to React consumers. `loading` is `true` only until the
 * first underlying delivery for a given queryKey; once data has been seen,
 * subscribers (including newly-mounted ones for a cached queryKey) get
 * `loading: false` immediately.
 */
export type CachedQueryResult = PatchesDbResult & { loading: boolean };

type Listener = () => void;

type CacheEntry = {
  queryKey: string;
  query: PatchesDbQuery;
  /** Stable result identity; replaced whenever data changes. */
  result: CachedQueryResult;
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

function makeLoadingResult(query: PatchesDbQuery): CachedQueryResult {
  return {
    query,
    entities: [] as Entity[],
    patches: [] as Patch[],
    total: 0,
    hasMore: false,
    nextCursor: null,
    loading: true,
  };
}

/**
 * Reuses entity/patch arrays across snapshots when nothing actually changed at
 * the row level. Avoids forcing downstream `useMemo` consumers to recompute on
 * every invalidation that doesn't move our query result. This is intentionally
 * shallow: two arrays are reused only when length and per-row identity match.
 */
function reuseStableArrays(
  prev: CachedQueryResult,
  next: PatchesDbResult
): { entities: Entity[]; patches: Patch[] } {
  const entities =
    prev.entities.length === next.entities.length &&
    prev.entities.every((e, i) => entityShallowEqual(e, next.entities[i]))
      ? prev.entities
      : next.entities;
  const patches =
    prev.patches.length === next.patches.length &&
    prev.patches.every((p, i) => p.patchId === next.patches[i]?.patchId)
      ? prev.patches
      : next.patches;
  return { entities, patches };
}

function entityShallowEqual(a: Entity, b: Entity | undefined): boolean {
  if (b === undefined) return false;
  if (a === b) return true;
  if (a.entityId !== b.entityId || a.entityType !== b.entityType) return false;
  const ak = Object.keys(a.attributes);
  const bk = Object.keys(b.attributes);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a.attributes[k] !== b.attributes[k]) return false;
  }
  return true;
}

export type PatchesDbQueryCacheOptions = {
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
 * subscribers so React consumers never see a `loading: true` flash for data
 * the cache has already loaded.
 */
export class PatchesDbQueryCache {
  private entries = new Map<string, CacheEntry>();
  private graceMs: number;
  private scheduler: NonNullable<PatchesDbQueryCacheOptions['scheduler']>;

  constructor(
    private readonly db: SubscribablePatchesDbLike,
    options: PatchesDbQueryCacheOptions = {}
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
    query: PatchesDbQuery,
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
          loading: false,
        };
        if (resultsShallowEqual(prev, nextResult)) {
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
   * Returns a stable snapshot for `queryKey`, materializing a loading entry if
   * none exists yet. Callers (e.g. `useSyncExternalStore.getSnapshot`) require
   * referential stability across calls, so we never return fresh objects.
   */
  getOrCreateResult(
    queryKey: string,
    query: PatchesDbQuery
  ): CachedQueryResult {
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

  private getOrCreate(queryKey: string, query: PatchesDbQuery): CacheEntry {
    const existing = this.entries.get(queryKey);
    if (existing !== undefined) return existing;
    const entry: CacheEntry = {
      queryKey,
      query,
      result: makeLoadingResult(query),
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

function resultsShallowEqual(
  a: CachedQueryResult,
  b: CachedQueryResult
): boolean {
  return (
    a.entities === b.entities &&
    a.patches === b.patches &&
    a.total === b.total &&
    a.hasMore === b.hasMore &&
    a.nextCursor === b.nextCursor &&
    a.loading === b.loading
  );
}

const cacheByDb = new WeakMap<SubscribablePatchesDbLike, PatchesDbQueryCache>();

/**
 * Returns the singleton `PatchesDbQueryCache` for `db`. Creating one cache per
 * db keeps subscribers from different containers isolated, while letting
 * every consumer of the same db share snapshots.
 */
export function getCacheForDb(
  db: SubscribablePatchesDbLike
): PatchesDbQueryCache {
  const existing = cacheByDb.get(db);
  if (existing !== undefined) return existing;
  const created = new PatchesDbQueryCache(db);
  cacheByDb.set(db, created);
  return created;
}
