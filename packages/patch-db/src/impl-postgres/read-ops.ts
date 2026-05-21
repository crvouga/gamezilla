import { assert } from '@gamezilla/assert';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { assertWhereFragment } from '@gamezilla/sqlite';
import { parseAttributes, toEntity, toPatch } from '../impl-sqlite/mappers';
import type { PatchRow, SnapshotRow } from '../impl-sqlite/types';
import type { Entity, Patch, PatchDbQuery, PatchDbResult } from '../interface';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
} from './query-builder-pg';
import { readOnePatchBased } from './read-ops-patch-based';
import {
  batchFetchPatchesForEntities,
  batchFetchSnapshots,
  computeHasMore,
  computeOrderedEntityKeys,
  rowAttributesText,
  toPatchRow,
} from './read-ops-shared';

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

/** `knownPatchIds` allowed (sync poll); still rejects `knownPatches` (would need hydration). */
function hasNoKnownPatches(q: PatchDbQuery): boolean {
  const kp = q.knownPatches;
  return kp === null || kp === undefined || kp.length === 0;
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

/** Solo snapshot fast-path: same as batchable atom, but allows `knownPatchIds` for SQL pruning. */
function isBareSingleEntityFastPathQuery(q: PatchDbQuery): boolean {
  return (
    isDefaultEntityView(q) &&
    hasBareStringEntityId(q) &&
    hasNoWhereOrOrderBy(q) &&
    hasNoKnownPatches(q) &&
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

async function readBareSingleEntityBatchPostgres(
  sqlClient: SqlClient,
  slice: readonly PatchDbQuery[]
): Promise<PatchDbResult[]> {
  const entityType = slice[0]?.entityType;
  assert.ok(
    entityType !== undefined && entityType !== '',
    'readBareSingleEntityBatchPostgres: entityType required'
  );
  const pairs = slice.map((q) => ({
    entity_id: q.entityId as string,
    entity_type: entityType,
  }));
  const excludePatchIds =
    slice.length === 1 &&
    slice[0]!.knownPatchIds !== undefined &&
    slice[0]!.knownPatchIds.length > 0
      ? slice[0]!.knownPatchIds
      : undefined;
  const allPatches = await batchFetchPatchesForEntities(
    sqlClient,
    pairs,
    excludePatchIds
  );
  const byKey = new Map<string, Patch[]>();
  for (const p of allPatches) {
    const k = `${p.entityId}\0${p.entityType}`;
    let list = byKey.get(k);
    if (list === undefined) {
      list = [];
      byKey.set(k, list);
    }
    list.push(p);
  }

  const keys = slice.map((q) => `${q.entityId as string}\0${entityType}`);
  const entitiesOrdered = await batchFetchSnapshots(sqlClient, keys);
  const entityByKey = new Map<string, Entity>(
    entitiesOrdered.map((e) => [`${e.entityId}\0${e.entityType}`, e])
  );

  return slice.map((query) => {
    const id = query.entityId as string;
    const k = `${id}\0${entityType}`;
    const patchList = byKey.get(k) ?? [];
    const total = patchList.length;
    const lim = query.limit;
    const patchesOut =
      lim === null || lim === undefined ? patchList : patchList.slice(0, lim);
    const hasMore = computeHasMore(query, patchesOut.length, total);
    const lastPatch = patchesOut[patchesOut.length - 1];
    const nextCursor =
      lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;
    const entityKeysOrdered = computeOrderedEntityKeys(patchesOut);
    const entities = entityKeysOrdered
      .map((key) => entityByKey.get(key))
      .filter((e): e is Entity => e !== undefined);
    return {
      query,
      entities,
      patches: patchesOut,
      total,
      hasMore,
      nextCursor,
    };
  });
}

export async function readPatches(
  sqlClient: SqlClient,
  queries: PatchDbQuery[]
): Promise<PatchDbResult[]> {
  if (queries.length === 0) return [];
  const results: PatchDbResult[] = new Array(queries.length);
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
    const slice = queries.slice(start, i);
    if (slice.length > 1) {
      const batch = await readBareSingleEntityBatchPostgres(sqlClient, slice);
      for (let k = 0; k < batch.length; k++) {
        const r = batch[k];
        assert.defined(r, 'batch result must exist', { k });
        results[start + k] = r;
      }
    } else {
      const q = slice[0];
      assert.defined(q, 'slice must be non-empty');
      results[start] = await readOne(sqlClient, q);
    }
  }
  return results;
}

async function readOne(
  sqlClient: SqlClient,
  query: PatchDbQuery
): Promise<PatchDbResult> {
  if (query.on === 'patches') {
    return readOnePatchesMode(sqlClient, query);
  }
  if (isBareSingleEntityFastPathQuery(query)) {
    const batch = await readBareSingleEntityBatchPostgres(sqlClient, [query]);
    const first = batch[0];
    assert.defined(first, 'readOne: bare fast-path must return one result');
    return first;
  }
  const isSingleEntityQuery = typeof query.entityId === 'string';
  const usePatchBasedLogic =
    (query.after !== null && query.after !== undefined) || isSingleEntityQuery;
  if (usePatchBasedLogic) {
    return readOnePatchBased(sqlClient, query);
  }
  return readOneSnapshotBased(sqlClient, query);
}

async function readOnePatchesMode(
  sqlClient: SqlClient,
  query: PatchDbQuery
): Promise<PatchDbResult> {
  const { conditions, params } = buildPatchConditions(query, 'p');
  const whereSQL = conditions.join(' AND ');

  const orderSQL = buildOrderSQL(query, 'ORDER BY p.patch_id ASC', 'p.');
  const limit = buildLimitSQL(query);

  const sql = `SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
              p.created_at, p.recorded_at, p.parent_id, COUNT(*) OVER() AS total_count
       FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'readOnePatchesMode' }
  );
  const rows = await sqlClient.query<
    PatchRow & { total_count: string | number }
  >(sql, allParams);

  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
  const patches = rows.map((r) => toPatch(toPatchRow(r)));
  const hasMore =
    query.limit !== null && query.limit !== undefined
      ? (query.offset ?? 0) + patches.length < total
      : false;
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, total, hasMore, nextCursor };
}

async function readOneSnapshotBased(
  sqlClient: SqlClient,
  query: PatchDbQuery
): Promise<PatchDbResult> {
  const { conditions, params } = buildSnapshotConditions(query);
  const whereSQL = conditions.join(' AND ');

  const orderSQL = buildOrderSQL(query, 'ORDER BY entity_id ASC');
  const limit = buildLimitSQL(query);

  const sql = `SELECT entity_id, entity_type, attributes::text AS attributes, COUNT(*) OVER() AS total_count FROM snapshots WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'readOneSnapshotBased' }
  );
  const rows = await sqlClient.query<
    SnapshotRow & { total_count: string | number }
  >(sql, allParams);

  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
  const entities = rows.map((r) =>
    toEntity({ ...r, attributes: rowAttributesText(r) })
  );
  const hasMore =
    query.limit !== null && query.limit !== undefined
      ? (query.offset ?? 0) + entities.length < total
      : false;

  const patches = await batchFetchPatchesForEntities(sqlClient, rows);

  return { query, entities, patches, total, hasMore, nextCursor: null };
}

export { batchFetchSnapshots, parseAttributes, rowAttributesText };
