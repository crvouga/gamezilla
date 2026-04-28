import { assert } from '@gamezilla/lib/assert';
import { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import { useEffect, useState } from 'react';
import {
  Entity,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
} from './interface';
import { SubscribablePatchesDbToken } from './subscribable';

export const PatchesDbToken: InjectionToken<PatchesDb> = Symbol('PatchesDb');

/** In-memory bus used by {@link SyncPatchesDb} (e.g. subscribe to sync-error topic). */
export const PatchDbSyncPubSubToken: InjectionToken<PubSub> =
  Symbol('PatchDbSyncPubSub');

export function usePatchesDb(): PatchesDb {
  const db = useDependency(PatchesDbToken);
  assert.defined(db, 'PatchesDb not found');
  return db;
}

/**
 * `loading` is `true` until the subscription delivers its first result.
 * Use it to avoid rendering default/fallback content (which can cause UI
 * flashes) while patch-db is still hydrating.
 */
export type UseEntitiesResult = PatchesDbResult & { loading: boolean };

export function useEntities(query: PatchesDbQuery): UseEntitiesResult {
  const db = useDependency(SubscribablePatchesDbToken);
  const [result, setResult] = useState<UseEntitiesResult>(() => ({
    query,
    entities: [],
    patches: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    loading: true,
  }));
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    setResult((prev) => ({ ...prev, loading: true }));
    const parsed: unknown = JSON.parse(queryKey);
    assert.record(
      parsed,
      'queryKey must roundtrip to object (from JSON.stringify of PatchesDbQuery)',
      { queryKey }
    );
    const parsedQuery = parsed as PatchesDbQuery;
    const unsubscribe = db.subscribe.entities(parsedQuery, (r) => {
      setResult((prev) => ({ ...prev, ...r, loading: false }));
    });
    return unsubscribe;
  }, [db, queryKey]);
  return result;
}

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  const first = entities.entities[0];
  return first ?? null;
}
