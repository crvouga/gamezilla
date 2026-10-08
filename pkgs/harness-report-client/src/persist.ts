/**
 * Persist the TanStack query cache. Frame-file queries stay out of this
 * document — those bytes live in {@link ReportCache} on their own keys.
 */

import {
  type Persister,
  persistQueryClient,
} from '@tanstack/query-persist-client-core';
import type { QueryClient } from '@tanstack/solid-query';

import type { ReportCache } from './fetcher';

const CACHE_KEY = 'reports-query-cache';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function reportPersister(cache: ReportCache): Persister {
  return {
    persistClient: (client) => cache.set(CACHE_KEY, JSON.stringify(client)),
    restoreClient: async () => {
      const raw = await cache.get(CACHE_KEY);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as Awaited<
          ReturnType<Persister['restoreClient']>
        >;
      } catch {
        await cache.remove(CACHE_KEY);
        return undefined;
      }
    },
    removeClient: () => cache.remove(CACHE_KEY),
  };
}

function keepQuery(query: {
  readonly queryKey: readonly unknown[];
  readonly state: { readonly status: string };
}): boolean {
  return query.state.status === 'success' && query.queryKey[1] !== 'blob';
}

/** Restore the cache, then keep writing it. Returns unsubscribe. */
export function attachReportCache(
  client: QueryClient,
  cache: ReportCache
): [() => void, Promise<void>] {
  return persistQueryClient({
    queryClient: client,
    persister: reportPersister(cache),
    maxAge: WEEK,
    buster: 'reports-v2',
    dehydrateOptions: { shouldDehydrateQuery: keepQuery },
  });
}
