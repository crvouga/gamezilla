import { assert } from '@gamezilla/lib/assert';
import { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  Entity,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
} from './interface';
import {
  CachedQueryResult,
  getCacheForDb,
} from './react-query-cache';
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
 * `loading` is `true` only until the first delivery for a given query has
 * arrived. Switching a hook to a query that another hook (or this hook in a
 * recent past life) has already loaded returns `loading: false` immediately —
 * use this flag to suppress fallback renders during initial hydration.
 */
export type UseEntitiesResult = PatchesDbResult & { loading: boolean };

/**
 * Subscribes to the cached snapshot for `query`. Identical query shapes share
 * a single underlying subscription; teardown is deferred briefly across
 * unmounts so route flips and conditional renders don't re-flash `loading`.
 */
export function useEntities(query: PatchesDbQuery): UseEntitiesResult {
  const db = useDependency(SubscribablePatchesDbToken);
  const cache = useMemo(() => getCacheForDb(db), [db]);
  const queryKey = JSON.stringify(query);

  const subscribe = useCallback(
    (listener: () => void) => {
      const parsed: unknown = JSON.parse(queryKey);
      assert.record(
        parsed,
        'queryKey must roundtrip to object (from JSON.stringify of PatchesDbQuery)',
        { queryKey }
      );
      return cache.subscribe(queryKey, parsed as PatchesDbQuery, listener);
    },
    [cache, queryKey]
  );

  const getSnapshot = useCallback((): CachedQueryResult => {
    const existing = cache.getResult(queryKey);
    if (existing !== null) return existing;
    const parsed: unknown = JSON.parse(queryKey);
    assert.record(
      parsed,
      'queryKey must roundtrip to object (from JSON.stringify of PatchesDbQuery)',
      { queryKey }
    );
    return cache.getOrCreateResult(queryKey, parsed as PatchesDbQuery);
  }, [cache, queryKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  const first = entities.entities[0];
  return first ?? null;
}
