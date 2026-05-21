import { assert } from '@gamezilla/assert';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Entity, PatchDbQuery } from '../interface';
import {
  buildQueryOneDescriptor,
  type QueryOneDescriptor,
} from './query-one-descriptor';
import { usePatchDb } from './patch-db-context';
import { getEntityStoreForDb } from './entity-store';
import { getCacheForDb } from './query-cache';

export function useQueryOne(query: PatchDbQuery): Entity | null {
  const db = usePatchDb();
  const entityStore = useMemo(() => getEntityStoreForDb(db), [db]);
  const queryCache = useMemo(() => getCacheForDb(db), [db]);

  const queryKey = JSON.stringify(query);
  const desc = useMemo((): QueryOneDescriptor => {
    const parsed: unknown = JSON.parse(queryKey);
    assert.record(parsed, 'useQueryOne: queryKey must roundtrip to object', {
      queryKey,
    });
    return buildQueryOneDescriptor(parsed as PatchDbQuery);
  }, [queryKey]);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (desc.kind === 'entity') {
        return entityStore.subscribe(desc.entityType, desc.entityId, listener);
      }
      return queryCache.subscribe(desc.queryKey, desc.query, listener);
    },
    [entityStore, queryCache, desc]
  );

  const getSnapshot = useCallback((): Entity | null => {
    if (desc.kind === 'entity') {
      const existing = entityStore.getResult(desc.entityType, desc.entityId);
      const snap =
        existing ??
        entityStore.getOrCreateResult(desc.entityType, desc.entityId);
      return snap.entity;
    }
    const existing = queryCache.getResult(desc.queryKey);
    const r =
      existing ?? queryCache.getOrCreateResult(desc.queryKey, desc.query);
    return r.entities[0] ?? null;
  }, [entityStore, queryCache, desc]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
