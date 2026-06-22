import type { Keyword } from '@pkgs/keyword';
import type { Entity, Patch, PatchDbQuery, PatchDbResult } from '../interface';
import { assertAttribute } from '../interface';

/**
 * Snapshot returned to React consumers. `isLoading` is `true` until the
 * cache receives its first delivery from the underlying subscription, which
 * lets consumers distinguish "query has not produced a result yet" from "the
 * query genuinely has no rows" — the on-disk shape is identical otherwise.
 */
export type CachedQueryResult = PatchDbResult & {
  isLoading: boolean;
};

export function makeEmptyResult(query: PatchDbQuery): CachedQueryResult {
  return {
    query,
    entities: [] as Entity[],
    patches: [] as Patch[],
    hasMore: false,
    nextCursor: null,
    isLoading: true,
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
  next: PatchDbResult
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
    assertAttribute(k);
    if (a.attributes[k as Keyword] !== b.attributes[k as Keyword]) return false;
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
    a.hasMore === b.hasMore &&
    a.nextCursor === b.nextCursor &&
    a.isLoading === b.isLoading
  );
}
