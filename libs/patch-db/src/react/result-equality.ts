import type {
  Entity,
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
} from '../interface';

/**
 * Snapshot returned to React consumers. `loading` is `true` only until the
 * first underlying delivery for a given queryKey; once data has been seen,
 * subscribers (including newly-mounted ones for a cached queryKey) get
 * `loading: false` immediately.
 */
export type CachedQueryResult = PatchesDbResult & { loading: boolean };

export function makeLoadingResult(query: PatchesDbQuery): CachedQueryResult {
  return {
    query,
    entities: [] as Entity[],
    patches: [] as Patch[],
    total: 0,
    hasMore: false,
    nextCursor: null,
    loading: true,
  };
}

/**
 * Reuses entity/patch arrays across snapshots when nothing actually changed at
 * the row level. Avoids forcing downstream `useMemo` consumers to recompute on
 * every invalidation that doesn't move our query result. This is intentionally
 * shallow: two arrays are reused only when length and per-row identity match.
 */
export function reuseStableArrays(
  prev: CachedQueryResult,
  next: PatchesDbResult
): { entities: Entity[]; patches: Patch[] } {
  const entities =
    prev.entities.length === next.entities.length &&
    prev.entities.every((e, i) => entityShallowEqual(e, next.entities[i]))
      ? prev.entities
      : next.entities;
  const patches =
    prev.patches.length === next.patches.length &&
    prev.patches.every((p, i) => p.patchId === next.patches[i]?.patchId)
      ? prev.patches
      : next.patches;
  return { entities, patches };
}

function entityShallowEqual(a: Entity, b: Entity | undefined): boolean {
  if (b === undefined) return false;
  if (a === b) return true;
  if (a.entityId !== b.entityId || a.entityType !== b.entityType) return false;
  const ak = Object.keys(a.attributes);
  const bk = Object.keys(b.attributes);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a.attributes[k] !== b.attributes[k]) return false;
  }
  return true;
}

export function resultsShallowEqual(
  a: CachedQueryResult,
  b: CachedQueryResult
): boolean {
  return (
    a.entities === b.entities &&
    a.patches === b.patches &&
    a.total === b.total &&
    a.hasMore === b.hasMore &&
    a.nextCursor === b.nextCursor &&
    a.loading === b.loading
  );
}
