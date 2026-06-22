/* eslint-disable complexity */
import { assert } from '@pkgs/assert';
import type { Unsubscribe } from '@pkgs/pub-sub/interface';
import type { Entity, Patch, PatchInput } from './interface';
import { PATCH_META_KEYS } from './interface';

export type EntityKey = string; // `${entityType}\0${entityId}`

export function toEntityKey(entityType: string, entityId: string): EntityKey {
  return `${entityType}\0${entityId}`;
}

type StoreListener = (touched: ReadonlySet<EntityKey>) => void;

export class InMemoryEntityStore {
  private byType = new Map<string, Map<string, Entity>>();
  private listeners = new Set<StoreListener>();
  version = 0;

  private applyAttributes(
    entityType: string,
    entityId: string,
    attributes: Record<string, unknown>
  ): boolean {
    let byId = this.byType.get(entityType);
    if (byId === undefined) {
      byId = new Map<string, Entity>();
      this.byType.set(entityType, byId);
    }
    const prev = byId.get(entityId) ?? null;
    const nextAttrs: Record<string, unknown> =
      prev?.attributes !== undefined ? { ...prev.attributes } : {};

    for (const [key, value] of Object.entries(attributes)) {
      if (PATCH_META_KEYS.includes(key)) continue;
      if (value === null) {
        delete nextAttrs[key];
      } else {
        nextAttrs[key] = value;
      }
    }

    if (Object.keys(nextAttrs).length === 0) {
      if (prev !== null) {
        byId.delete(entityId);
        if (byId.size === 0) this.byType.delete(entityType);
        return true;
      }
      return false;
    }

    const next: Entity = { entityId, entityType, attributes: nextAttrs };
    byId.set(entityId, next);
    return prev === null || prev !== next;
  }

  clear(): void {
    if (this.byType.size === 0) return;
    // Clearing everything is a full invalidation. Emit once.
    this.byType.clear();
    this.bumpAndEmit(new Set());
  }

  getEntity(entityType: string, entityId: string): Entity | null {
    const byId = this.byType.get(entityType);
    if (byId === undefined) return null;
    return byId.get(entityId) ?? null;
  }

  *iterByType(entityType: string): Iterable<Entity> {
    const byId = this.byType.get(entityType);
    if (byId === undefined) return;
    yield* byId.values();
  }

  *iterAll(): Iterable<Entity> {
    for (const byId of this.byType.values()) {
      yield* byId.values();
    }
  }

  upsertEntities(entities: readonly Entity[]): void {
    if (entities.length === 0) return;
    const touched = new Set<EntityKey>();
    for (const e of entities) {
      if (this.applyAttributes(e.entityType, e.entityId, e.attributes)) {
        touched.add(toEntityKey(e.entityType, e.entityId));
      }
    }
    if (touched.size > 0) this.bumpAndEmit(touched);
  }

  removeEntities(
    keys: readonly { entityType: string; entityId: string }[]
  ): void {
    if (keys.length === 0) return;
    const touched = new Set<EntityKey>();
    for (const k of keys) {
      const byId = this.byType.get(k.entityType);
      if (byId === undefined) continue;
      if (byId.delete(k.entityId)) {
        touched.add(toEntityKey(k.entityType, k.entityId));
      }
      if (byId.size === 0) {
        this.byType.delete(k.entityType);
      }
    }
    if (touched.size > 0) this.bumpAndEmit(touched);
  }

  /**
   * Applies accepted patches to the in-memory snapshot model using last-wins
   * semantics: each non-null attribute overwrites, and `null` deletes.
   *
   * Mirrors `mergePatchRowsIntoMergedRecord` behavior in
   * `impl-sqlite/sqlite-snapshot-recompute.ts` for snapshot attributes.
   */
  applyAcceptedPatches(patches: readonly Patch[]): void {
    if (patches.length === 0) return;
    const touched = new Set<EntityKey>();
    for (const p of patches) {
      if (this.applyAttributes(p.entityType, p.entityId, p.attributes)) {
        touched.add(toEntityKey(p.entityType, p.entityId));
      }
    }
    if (touched.size > 0) this.bumpAndEmit(touched);
  }

  /**
   * Optimistically applies patch inputs (before persistence completes).
   * Uses the same attribute merge semantics as {@link applyAcceptedPatches}.
   */
  applyPatchInputs(patches: readonly PatchInput[]): void {
    if (patches.length === 0) return;
    const touched = new Set<EntityKey>();
    for (const p of patches) {
      if (this.applyAttributes(p.entityType, p.entityId, p.attributes)) {
        touched.add(toEntityKey(p.entityType, p.entityId));
      }
    }
    if (touched.size > 0) this.bumpAndEmit(touched);
  }

  subscribe(listener: StoreListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private bumpAndEmit(touched: Set<EntityKey>): void {
    this.version += 1;
    for (const l of [...this.listeners]) {
      try {
        l(touched);
      } catch (err) {
        // Store listeners must not break mutations.
        assert.ok(true, 'InMemoryEntityStore listener error swallowed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
