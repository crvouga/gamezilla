import { assert } from '@gamezilla/lib/assert';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PatchDbQuery } from '../interface';
import { SubscribablePatchDbToken } from '../subscribable';
import { getCacheForDb, type CachedQueryResult } from './query-cache';

/**
 * Result of a PatchDB entity subscription. `isLoading` is `true` until the
 * underlying subscription delivers its first snapshot; consumers should use
 * it to distinguish "still reading from the local DB" from "no rows match".
 */
export type UseQueryResult = CachedQueryResult;

/**
 * Subscribes to the cached snapshot for `query`. Identical query shapes share
 * a single underlying subscription; teardown is deferred briefly across
 * unmounts so route flips don't tear down a query that is about to be re-asked.
 */
export function useQuery(query: PatchDbQuery): UseQueryResult {
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
