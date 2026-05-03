import { assert } from '@gamezilla/lib/assert';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PatchDbQuery, PatchDbResult } from '../interface';
import { SubscribablePatchDbToken } from '../subscribable';
import { getCacheForDb, type CachedQueryResult } from './query-cache';

/**
 * Result of a PatchDB entity subscription. Before the first delivery, the
 * snapshot is empty arrays with zero totals — indistinguishable from a query
 * that genuinely returns no rows (local-first).
 */
export type UseEntitiesResult = PatchDbResult;

/**
 * Subscribes to the cached snapshot for `query`. Identical query shapes share
 * a single underlying subscription; teardown is deferred briefly across
 * unmounts so route flips don't tear down a query that is about to be re-asked.
 */
export function useEntities(query: PatchDbQuery): UseEntitiesResult {
  const db = useDependency(SubscribablePatchDbToken);
  const cache = useMemo(() => getCacheForDb(db), [db]);
  const queryKey = JSON.stringify(query);

  const subscribe = useCallback(
    (listener: () => void) => {
      const parsed: unknown = JSON.parse(queryKey);
      assert.record(
        parsed,
        'queryKey must roundtrip to object (from JSON.stringify of PatchDbQuery)',
        { queryKey }
      );
      return cache.subscribe(queryKey, parsed as PatchDbQuery, listener);
    },
    [cache, queryKey]
  );

  const getSnapshot = useCallback((): CachedQueryResult => {
    const existing = cache.getResult(queryKey);
    if (existing !== null) return existing;
    const parsed: unknown = JSON.parse(queryKey);
    assert.record(
      parsed,
      'queryKey must roundtrip to object (from JSON.stringify of PatchDbQuery)',
      { queryKey }
    );
    return cache.getOrCreateResult(queryKey, parsed as PatchDbQuery);
  }, [cache, queryKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
