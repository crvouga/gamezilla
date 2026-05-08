import { assert } from '@gamezilla/lib/assert';
import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { Entity } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import { DEFAULT_TEARDOWN_GRACE_MS, type PatchDbQueryCacheOptions } from './query-cache';
import { getInMemoryStoreForDb } from './in-memory-store-registry';

/**
 * Snapshot for a single-entity subscription.
 */
export type CachedEntitySnapshot = {
  entity: Entity | null;
};

type Listener = () => void;

type EntityCacheEntry = {
  entityType: string;
  entityId: string;
  /** Stable snapshot; replaced when data changes. */
  result: CachedEntitySnapshot;
  listeners: Set<Listener>;
  teardownTimer: unknown | null;
};

function entityKey(entityType: string, entityId: string): string {
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
    if (a.attributes[k] !== b.attributes[k]) return false;
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
    entityType: string,
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

  getResult(entityType: string, entityId: string): CachedEntitySnapshot | null {
    return this.entries.get(entityKey(entityType, entityId))?.result ?? null;
  }

  getOrCreateResult(
    entityType: string,
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

  isOpen(entityType: string, entityId: string): boolean {
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
      entry.listeners.clear();
    }
    this.entries.clear();
  }

  private getOrCreate(
    key: string,
    entityType: string,
    entityId: string
  ): EntityCacheEntry {
    const existing = this.entries.get(key);
    if (existing !== undefined) return existing;
    const entry: EntityCacheEntry = {
      entityType,
      entityId,
      result: { entity: null },
      listeners: new Set(),
      teardownTimer: null,
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
    this.entries.delete(entityKey(entry.entityType, entry.entityId));
  }
}

const storeByDb = new WeakMap<SubscribablePatchDbLike, PatchDbEntityStore>();

export function getEntityStoreForDb(db: SubscribablePatchDbLike): PatchDbEntityStore {
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
