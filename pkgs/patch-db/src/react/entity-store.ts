import { assert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword';
import type { Unsubscribe } from '@pkgs/pub-sub/interface';
import type { Entity, PatchEntityType } from '../interface';
import { assertAttribute } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import {
  DEFAULT_TEARDOWN_GRACE_MS,
  type PatchDbQueryCacheOptions,
} from './query-cache';
import { getInMemoryStoreForDb } from './in-memory-store-registry';

/**
 * Snapshot for a single-entity subscription.
 */
export type CachedEntitySnapshot = {
  entity: Entity | null;
};

type Listener = () => void;

type EntityCacheEntry = {
  entityType: PatchEntityType;
  entityId: string;
  /** Stable snapshot; replaced when data changes. */
  result: CachedEntitySnapshot;
  listeners: Set<Listener>;
  teardownTimer: unknown | null;
  /**
   * Registers this entity with {@link SubscribablePatchDbLike.subscribe.entities}
   * so the sync layer (e.g. {@link SyncPatchDb}) polls remote rows into local
   * storage — mirrors {@link PatchDbQueryCache}.
   */
  syncEntitiesUnsub: Unsubscribe | null;
};

function entityKey(entityType: PatchEntityType, entityId: string): string {
  return `${entityType}\0${entityId}`;
}

function entityShallowEqual(a: Entity | null, b: Entity | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.entityId !== b.entityId || a.entityType !== b.entityType) return false;
  const ak = Object.keys(a.attributes);
  const bk = Object.keys(b.attributes);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    assertAttribute(k);
    if (a.attributes[k as Keyword] !== b.attributes[k as Keyword]) return false;
  }
  return true;
}

/**
 * Per-(entityType, entityId) subscriptions sharing one underlying
 * `db.subscribe.entities({ entityType, entityId, limit: 1 })`.
 */
export class PatchDbEntityStore {
  private entries = new Map<string, EntityCacheEntry>();
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

  subscribe(
    entityType: PatchEntityType,
    entityId: string,
    listener: Listener
  ): Unsubscribe {
    const key = entityKey(entityType, entityId);
    const entry = this.getOrCreate(key, entityType, entityId);

    if (entry.teardownTimer !== null) {
      this.scheduler.clearTimeout(entry.teardownTimer);
      entry.teardownTimer = null;
    }

    entry.listeners.add(listener);

    const store = getInMemoryStoreForDb(this.db);
    const nextEntity = store.getEntity(entityType, entityId);
    const prev = entry.result.entity;
    const entity =
      nextEntity !== null && entityShallowEqual(prev, nextEntity)
        ? prev
        : nextEntity;
    if (prev !== entity) {
      entry.result = { entity };
      listener();
    }

    if (entry.syncEntitiesUnsub === null) {
      entry.syncEntitiesUnsub = this.db.subscribe.entities(
        { entityType: entry.entityType, entityId: entry.entityId, limit: 1 },
        () => {
          /* Sync layer drives local SQLite + hydrate; store reacts via in-memory mirror. */
        }
      );
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

  getResult(
    entityType: PatchEntityType,
    entityId: string
  ): CachedEntitySnapshot | null {
    return this.entries.get(entityKey(entityType, entityId))?.result ?? null;
  }

  getOrCreateResult(
    entityType: PatchEntityType,
    entityId: string
  ): CachedEntitySnapshot {
    return this.getOrCreate(
      entityKey(entityType, entityId),
      entityType,
      entityId
    ).result;
  }

  size(): number {
    return this.entries.size;
  }

  isOpen(entityType: PatchEntityType, entityId: string): boolean {
    const entry = this.entries.get(entityKey(entityType, entityId));
    return entry !== undefined && this.storeUnsub !== null;
  }

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

  private getOrCreate(
    key: string,
    entityType: PatchEntityType,
    entityId: string
  ): EntityCacheEntry {
    const existing = this.entries.get(key);
    if (existing !== undefined) return existing;
    /**
     * Seed the new entry from the in-memory mirror so a `useEntity` mounted
     * for an entity already present in memory (e.g. a puzzle just shown by
     * the picker) renders synchronously instead of waiting for the next
     * `bumpAndEmit` (next sync poll re-hydrate, ~poll-interval later).
     * Mirrors {@link PatchDbQueryCache.getOrCreate}, which already evaluates
     * its query against the store at creation time.
     */
    const seeded = getInMemoryStoreForDb(this.db).getEntity(
      entityType,
      entityId
    );
    const entry: EntityCacheEntry = {
      entityType,
      entityId,
      result: { entity: seeded },
      listeners: new Set(),
      teardownTimer: null,
      syncEntitiesUnsub: null,
    };
    this.entries.set(key, entry);
    return entry;
  }

  private onStoreChanged(touched: ReadonlySet<string>): void {
    const store = getInMemoryStoreForDb(this.db);
    for (const entry of this.entries.values()) {
      if (entry.listeners.size === 0) continue;
      const key = entityKey(entry.entityType, entry.entityId);
      if (touched.size > 0 && !touched.has(key)) continue;
      const nextEntity = store.getEntity(entry.entityType, entry.entityId);
      const prev = entry.result;
      const entity =
        nextEntity !== null && entityShallowEqual(prev.entity, nextEntity)
          ? prev.entity
          : nextEntity;
      if (prev.entity === entity) continue;
      entry.result = { entity };
      for (const l of [...entry.listeners]) l();
    }
  }

  private teardown(entry: EntityCacheEntry): void {
    assert.ok(
      entry.listeners.size === 0,
      'entity store teardown called with active listeners',
      { key: entityKey(entry.entityType, entry.entityId) }
    );
    entry.teardownTimer = null;
    entry.syncEntitiesUnsub?.();
    entry.syncEntitiesUnsub = null;
    this.entries.delete(entityKey(entry.entityType, entry.entityId));
  }
}

const storeByDb = new WeakMap<SubscribablePatchDbLike, PatchDbEntityStore>();

export function getEntityStoreForDb(
  db: SubscribablePatchDbLike
): PatchDbEntityStore {
  const existing = storeByDb.get(db);
  if (existing !== undefined) return existing;
  const created = new PatchDbEntityStore(db);
  storeByDb.set(db, created);
  return created;
}

export function forceDetachPatchDbEntitySubscriptionsForDb(
  db: SubscribablePatchDbLike
): void {
  const store = storeByDb.get(db);
  if (store === undefined) return;
  store.forceDetachAll();
  storeByDb.delete(db);
}
