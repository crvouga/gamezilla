import type { PatchDbQuery } from './interface';

/** True when a limit+1 over-fetch returned more rows than the requested limit. */
export function hasMoreFromOverFetch(
  query: PatchDbQuery,
  fetchedCount: number
): boolean {
  if (query.after !== null && query.after !== undefined) {
    return (
      query.limit !== null &&
      query.limit !== undefined &&
      fetchedCount >= query.limit
    );
  }
  if (query.limit !== null && query.limit !== undefined) {
    return fetchedCount > query.limit;
  }
  return false;
}

export function trimToRequestedLimit<T>(
  items: readonly T[],
  query: PatchDbQuery
): T[] {
  if (query.limit === null || query.limit === undefined) return [...items];
  return items.slice(0, query.limit);
}
