import type {
  DataTableLoadPage,
  DataTableOrderDir,
  DataTablePageCacheEntry,
} from './data-table-types';

export type PageView<T> =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly rows: readonly T[];
      readonly totalCount: number;
    }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'empty'; readonly totalCount: 0 };

export type CacheMaps<T> = {
  readonly cache: Map<string, DataTablePageCacheEntry<T>>;
  readonly inflight: Map<string, Promise<DataTablePageCacheEntry<T>>>;
};

export function createCacheMaps<T>(): CacheMaps<T> {
  return { cache: new Map(), inflight: new Map() };
}

export function entryToView<T>(entry: DataTablePageCacheEntry<T>): PageView<T> {
  if (entry.status === 'error') {
    return { status: 'error', message: entry.message };
  }
  if (entry.totalCount === 0) {
    return { status: 'empty', totalCount: 0 };
  }
  return {
    status: 'ready',
    rows: entry.rows,
    totalCount: entry.totalCount,
  };
}

export function ensurePageLoad<T>(args: {
  readonly maps: CacheMaps<T>;
  readonly key: string;
  readonly loadPage: DataTableLoadPage<T>;
  readonly offset: number;
  readonly pageSize: number;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
}): Promise<DataTablePageCacheEntry<T>> {
  const { maps, key, loadPage, offset, pageSize, orderBy, orderDir } = args;
  const cached = maps.cache.get(key);
  if (cached != null) return Promise.resolve(cached);
  const existing = maps.inflight.get(key);
  if (existing != null) return existing;
  const promise = loadPage({ offset, limit: pageSize, orderBy, orderDir })
    .then(
      (result): DataTablePageCacheEntry<T> => ({
        status: 'ready',
        rows: result.rows,
        totalCount: result.totalCount,
      }),
      (err: unknown): DataTablePageCacheEntry<T> => ({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    )
    .then((entry) => {
      maps.cache.set(key, entry);
      maps.inflight.delete(key);
      return entry;
    });
  maps.inflight.set(key, promise);
  return promise;
}
