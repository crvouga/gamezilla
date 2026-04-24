import { assert } from '@gamezilla/shared/assert';
import { InjectionToken } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { useDependency } from '@gamezilla/shared/dependency-injection/react';
import type { PubSub } from '@gamezilla/shared/pub-sub/interface';
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
export const PatchDbSyncPubSubToken: InjectionToken<PubSub> = Symbol(
  'PatchDbSyncPubSub'
);

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
  const [result, setResult] = useState<PatchesDbResult>(() => ({
    query,
    entities: [],
    patches: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
  }));
  const [loading, setLoading] = useState(true);
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    setLoading(true);
    const parsed: unknown = JSON.parse(queryKey);
    assert.ok(
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      'queryKey must roundtrip to object (from JSON.stringify of PatchesDbQuery)',
      { queryKey }
    );
    const parsedQuery = parsed as PatchesDbQuery;
    const unsubscribe = db.subscribe.entities(parsedQuery, (r) => {
      setResult(r);
      setLoading(false);
    });
    return unsubscribe;
  }, [db, queryKey]);
  return { ...result, loading };
}

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  const first = entities.entities[0];
  return first ?? null;
}
