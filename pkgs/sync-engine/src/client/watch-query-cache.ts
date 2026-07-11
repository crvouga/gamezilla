type WatchQueryCacheEntry = {
  readonly rows: readonly Record<string, unknown>[];
  readonly confirmedEmpty: boolean;
};

const cache = new Map<string, WatchQueryCacheEntry>();

export function watchQueryCacheKey(sql: string, paramsKey: string): string {
  return `${sql}\0${paramsKey}`;
}

export function readWatchQueryCache(
  key: string
): WatchQueryCacheEntry | undefined {
  return cache.get(key);
}

export function writeWatchQueryCache(
  key: string,
  entry: WatchQueryCacheEntry
): void {
  cache.set(key, entry);
}

/** Cleared on sign-out / local DB wipe so stale rows never bleed across identities. */
export function clearWatchQueryCache(): void {
  cache.clear();
}
