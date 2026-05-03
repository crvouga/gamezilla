import { assert } from '@gamezilla/lib/assert';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PatchesDbQuery, PatchesDbResult } from '../interface';
import { SubscribablePatchesDbToken } from '../subscribable';
import { getCacheForDb, type CachedQueryResult } from './query-cache';

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
