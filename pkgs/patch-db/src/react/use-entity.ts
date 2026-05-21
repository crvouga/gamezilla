import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Entity, PatchEntityType } from '../interface';
import { usePatchDb } from './patch-db-context';
import { getEntityStoreForDb } from './entity-store';

/**
 * Subscribes to a single entity by `(entityType, entityId)` with at most one
 * underlying `subscribe.entities` per id (shared across attribute atoms).
 */
export function useEntity(
  entityType: PatchEntityType,
  entityId: string
): Entity | null {
  const db = usePatchDb();
  const store = useMemo(() => getEntityStoreForDb(db), [db]);

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(entityType, entityId, listener),
    [store, entityType, entityId]
  );

  const getSnapshot = useCallback((): Entity | null => {
    const existing = store.getResult(entityType, entityId);
    if (existing !== null) return existing.entity;
    const created = store.getOrCreateResult(entityType, entityId);
    return created.entity;
  }, [store, entityType, entityId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
