import { assert } from '@gamezilla/lib/assert';
import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { Entity, PatchDbQuery } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import { DEFAULT_TEARDOWN_GRACE_MS, type PatchDbQueryCacheOptions } from './query-cache';

/**
 * Snapshot for a single-entity subscription. `isLoading` is `true` until the
 * first delivery from `subscribe.entities`.
 */
export type CachedEntitySnapshot = {
  entity: Entity | null;
  isLoading: boolean;
};

type Listener = () => void;

type EntityCacheEntry = {
  entityType: string;
  entityId: string;
  /** Stable snapshot; replaced when data changes. */
  result: CachedEntitySnapshot;
  hasDelivered: boolean;
  listeners: Set<Listener>;
  unsubscribe: Unsubscribe | null;
  teardownTimer: unknown | null;
};

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}\0${entityId}`;
}

function makeEmptyEntitySnapshot(): CachedEntitySnapshot {
  return { entity: null, isLoading: true };
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

    if (entry.unsubscribe === null) {
      const query: PatchDbQuery = { entityType, entityId, limit: 1 };
      entry.unsubscribe = this.db.subscribe.entities(query, (next) => {
        const prev = entry.result;
        const first = next.entities[0] ?? null;
        const entity =
          first !== null && entityShallowEqual(prev.entity, first)
            ? prev.entity
            : first;
        const nextResult: CachedEntitySnapshot = {
          entity,
          isLoading: false,
        };
        const firstDelivery = !entry.hasDelivered;
        entry.hasDelivered = true;
        if (
          !firstDelivery &&
          prev.entity === nextResult.entity &&
          prev.isLoading === nextResult.isLoading
        ) {
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
    return entry?.unsubscribe !== null && entry !== undefined;
  }

  forceDetachAll(): void {
    for (const entry of this.entries.values()) {
      if (entry.teardownTimer !== null) {
        this.scheduler.clearTimeout(entry.teardownTimer);
        entry.teardownTimer = null;
      }
      if (entry.unsubscribe !== null) {
        entry.unsubscribe();
        entry.unsubscribe = null;
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
      result: makeEmptyEntitySnapshot(),
      hasDelivered: false,
      listeners: new Set(),
      unsubscribe: null,
      teardownTimer: null,
    };
    this.entries.set(key, entry);
    return entry;
  }

  private teardown(entry: EntityCacheEntry): void {
    assert.ok(
      entry.listeners.size === 0,
      'entity store teardown called with active listeners',
      { key: entityKey(entry.entityType, entry.entityId) }
    );
    if (entry.unsubscribe !== null) {
      entry.unsubscribe();
      entry.unsubscribe = null;
    }
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
