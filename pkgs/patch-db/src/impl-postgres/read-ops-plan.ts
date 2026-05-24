/**
 * Pure read-batch planner used by {@link ./read-ops} `readPatches`. No SQL
 * execution — only query-shape classification, unit scheduling, and result
 * rehydration helpers.
 */
import { assert } from '@pkgs/assert';
import type { PatchDbQuery, PatchDbResult } from '../interface';

function isDefaultEntityView(q: PatchDbQuery): boolean {
  return q.on !== 'patches';
}

function hasBareStringEntityId(q: PatchDbQuery): boolean {
  return (
    typeof q.entityId === 'string' &&
    q.entityType !== undefined &&
    q.entityType !== ''
  );
}

function hasNoWhereOrOrderBy(q: PatchDbQuery): boolean {
  return (
    (q.where === null || q.where === undefined) &&
    (q.orderBy === null || q.orderBy === undefined)
  );
}

function hasNoKnownPatchHints(q: PatchDbQuery): boolean {
  const kp = q.knownPatches;
  if (kp !== null && kp !== undefined && kp.length > 0) return false;
  const kpi = q.knownPatchIds;
  if (kpi !== null && kpi !== undefined && kpi.length > 0) return false;
  return true;
}

function hasAtomPaginationDefaults(q: PatchDbQuery): boolean {
  if (q.after !== null && q.after !== undefined) return false;
  if (q.offset !== null && q.offset !== undefined && q.offset !== 0)
    return false;
  if (q.limit !== null && q.limit !== undefined && q.limit !== 1) return false;
  return true;
}

function isBareSingleEntityAtomQuery(q: PatchDbQuery): boolean {
  return (
    isDefaultEntityView(q) &&
    hasBareStringEntityId(q) &&
    hasNoWhereOrOrderBy(q) &&
    hasNoKnownPatchHints(q) &&
    hasAtomPaginationDefaults(q)
  );
}

function canExtendBareSingleEntityBatch(
  queries: readonly PatchDbQuery[],
  start: number,
  idx: number
): boolean {
  if (idx <= start) return true;
  const a = queries[start];
  const b = queries[idx];
  if (a === undefined || b === undefined) return false;
  return (
    isBareSingleEntityAtomQuery(a) &&
    isBareSingleEntityAtomQuery(b) &&
    a.entityType === b.entityType
  );
}

/**
 * Stable shape key per query — entity type, canonical where shape, ordering,
 * and pagination. Used to sort the parallel-dispatched slice so logs from
 * two requests with the same payload reach the same partition cache lines
 * in the same order, and so debug `metrics.sortIndex` is deterministic.
 */
export function shapeKeyForQuery(q: PatchDbQuery): string {
  return JSON.stringify({
    entityType: q.entityType ?? '',
    on: q.on ?? 'entities',
    where: q.where ?? null,
    orderBy: q.orderBy ?? null,
    limit: q.limit ?? null,
    offset: q.offset ?? null,
    after: q.after ?? null,
  });
}

/**
 * Snapshot of the work scheduled by {@link readPatches} for one input batch.
 */
export type ReadUnit =
  | {
      readonly kind: 'bareBatch';
      readonly indices: readonly number[];
      readonly slice: readonly PatchDbQuery[];
    }
  | {
      readonly kind: 'one';
      readonly index: number;
      readonly query: PatchDbQuery;
    };

export function planReadUnits(queries: readonly PatchDbQuery[]): ReadUnit[] {
  const units: ReadUnit[] = [];
  let i = 0;
  while (i < queries.length) {
    const start = i;
    i += 1;
    while (
      i < queries.length &&
      canExtendBareSingleEntityBatch(queries, start, i)
    ) {
      i += 1;
    }
    if (i - start > 1) {
      const indices: number[] = [];
      for (let k = start; k < i; k++) indices.push(k);
      units.push({
        kind: 'bareBatch',
        indices,
        slice: queries.slice(start, i),
      });
    } else {
      const q = queries[start];
      assert.defined(q, 'planReadUnits: query slot must be defined');
      units.push({ kind: 'one', index: start, query: q });
    }
  }
  return units;
}

export function compareSingleUnits(
  a: { readonly index: number; readonly query: PatchDbQuery },
  b: { readonly index: number; readonly query: PatchDbQuery }
): number {
  const ka = shapeKeyForQuery(a.query);
  const kb = shapeKeyForQuery(b.query);
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return a.index - b.index;
}

type SingleReadUnit = {
  readonly index: number;
  readonly query: PatchDbQuery;
};

export function partitionReadUnits(units: readonly ReadUnit[]): {
  singles: SingleReadUnit[];
  batches: Array<Extract<ReadUnit, { kind: 'bareBatch' }>>;
} {
  const singles: SingleReadUnit[] = [];
  const batches: Array<Extract<ReadUnit, { kind: 'bareBatch' }>> = [];
  for (const u of units) {
    if (u.kind === 'bareBatch') {
      batches.push(u);
    } else {
      singles.push({ index: u.index, query: u.query });
    }
  }
  singles.sort(compareSingleUnits);
  return { singles, batches };
}

export function rehydrateReadResults(
  results: PatchDbResult[],
  batchOutcomes: Array<{
    unit: Extract<ReadUnit, { kind: 'bareBatch' }>;
    batchResults: PatchDbResult[];
  }>,
  singleOutcomes: Array<{ index: number; result: PatchDbResult }>
): void {
  for (const { unit, batchResults } of batchOutcomes) {
    assert.ok(
      batchResults.length === unit.indices.length,
      'bare-entity batch returned unexpected length',
      { expected: unit.indices.length, got: batchResults.length }
    );
    for (let k = 0; k < unit.indices.length; k++) {
      const dest = unit.indices[k];
      const r = batchResults[k];
      assert.ok(
        dest !== undefined && r !== undefined,
        'batch indices must align'
      );
      results[dest] = r;
    }
  }
  for (const { index, result } of singleOutcomes) {
    results[index] = result;
  }
}
