/** Stable key for a watched SQL query (registry / identity). */
export function watchQueryCacheKey(sql: string, paramsKey: string): string {
  return `${sql}\0${paramsKey}`;
}

/**
 * @deprecated No-op. Watch queries no longer cache row snapshots — callers kept
 * for identity-flush / wipe sites that previously cleared the map.
 */
export function clearWatchQueryCache(): void {
  // Intentionally empty: live watches are the only source of truth.
}
