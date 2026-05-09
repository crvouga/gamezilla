import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertWhereFragment } from '@gamezilla/lib/sqlite';
import { parseAttributes, toEntity, toPatch } from '../impl-sqlite/mappers';
import type { PatchRow, SnapshotRow } from '../impl-sqlite/types';
import type { Entity, Patch, PatchDbQuery, PatchDbResult } from '../interface';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
} from './query-builder-pg';
import { SELECT_DEPTH_BY_PATCH_ID } from './sql-constants';

function rowAttributesText(row: PatchRow | SnapshotRow): string {
  const a = row.attributes;
  if (typeof a === 'string') return a;
  return JSON.stringify(a);
}

function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

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

/**
 * Split for patch-based reads: lineage CTE is scoped to matching entities (not the full table);
 * optional `matching_entities` CTE when `where` filters snapshots without a concrete `entityId`.
 */
type LineageCandSplit = {
  useMatchingEntities: boolean;
  snapWhereSQL: string;
  snapParams: unknown[];
  lineageSeedPredicate: string;
  lineageStepPredicate: string;
  lineageParams: unknown[];
  candConditions: string[];
  candParams: unknown[];
};

function buildLineageCandSplit(
  query: PatchDbQuery,
  snapWhereSQL: string,
  snapParams: unknown[]
): LineageCandSplit {
  const hasWhere = query.where !== null && query.where !== undefined;
  const entityType = query.entityType;
  const eid = query.entityId;
  const typeDefined =
    entityType !== null && entityType !== undefined && entityType !== '';

  const useMatchingEntities = hasWhere && eid === undefined;

  const candSnapshot: { cond: string; params: unknown[] }[] = [];
  if (hasWhere && !useMatchingEntities) {
    candSnapshot.push({
      cond: `(p.entity_id, p.entity_type) IN (SELECT s.entity_id, s.entity_type FROM snapshots s WHERE ${snapWhereSQL})`,
      params: [...snapParams],
    });
  }

  if (useMatchingEntities) {
    return {
      useMatchingEntities: true,
      snapWhereSQL,
      snapParams,
      lineageSeedPredicate:
        '(entity_id, entity_type) IN (SELECT entity_id, entity_type FROM matching_entities)',
      lineageStepPredicate:
        '(p.entity_id, p.entity_type) IN (SELECT entity_id, entity_type FROM matching_entities)',
      lineageParams: [],
      candConditions: [],
      candParams: [],
    };
  }

  const candConditions = candSnapshot.map((c) => c.cond);
  const candParams = candSnapshot.flatMap((c) => c.params);

  if (Array.isArray(eid)) {
    if (eid.length === 0) {
      return {
        useMatchingEntities: false,
        snapWhereSQL,
        snapParams,
        lineageSeedPredicate: '1 = 0',
        lineageStepPredicate: '1 = 0',
        lineageParams: [],
        candConditions,
        candParams,
      };
    }
    assert.ok(typeDefined, 'entityType required when entityId is an array', {
      query,
    });
    const ph = eid.map(() => '?').join(', ');
    return {
      useMatchingEntities: false,
      snapWhereSQL,
      snapParams,
      lineageSeedPredicate: `entity_type = ? AND entity_id IN (${ph})`,
      lineageStepPredicate: `p.entity_type = ? AND p.entity_id IN (${ph})`,
      lineageParams: [entityType!, ...eid, entityType!, ...eid],
      candConditions,
      candParams,
    };
  }

  if (typeof eid === 'string') {
    assert.ok(typeDefined, 'entityType required when entityId is a string', {
      query,
    });
    return {
      useMatchingEntities: false,
      snapWhereSQL,
      snapParams,
      lineageSeedPredicate: 'entity_type = ? AND entity_id = ?',
      lineageStepPredicate: 'p.entity_type = ? AND p.entity_id = ?',
      lineageParams: [entityType!, eid, entityType!, eid],
      candConditions,
      candParams,
    };
  }

  if (typeDefined) {
    return {
      useMatchingEntities: false,
      snapWhereSQL,
      snapParams,
      lineageSeedPredicate: 'entity_type = ?',
      lineageStepPredicate: 'p.entity_type = ?',
      lineageParams: [entityType!, entityType!],
      candConditions,
      candParams,
    };
  }

  return {
    useMatchingEntities: false,
    snapWhereSQL,
    snapParams,
    lineageSeedPredicate: '1=1',
    lineageStepPredicate: '1=1',
    lineageParams: [],
    candConditions,
    candParams,
  };
}

type Cursor = { condition: string; params: unknown[] };

function candWhereSql(split: LineageCandSplit): string {
  const base =
    split.candConditions.length > 0
      ? split.candConditions.join(' AND ')
      : '1=1';
  return base;
}

/** When `mode === 'count'`, `orderSQL` and `limitSql` are ignored. */
function buildPatchBasedSql(
  split: LineageCandSplit,
  cursorCondition: string,
  orderSQL: string,
  limitSql: string,
  mode: 'select' | 'count'
): string {
  const withPrefix = split.useMatchingEntities
    ? `WITH RECURSIVE matching_entities AS (SELECT s.entity_id, s.entity_type FROM snapshots s WHERE ${split.snapWhereSQL}), `
    : `WITH RECURSIVE `;

  const candWhere = candWhereSql(split);

  const core = `${withPrefix}lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE parent_id IS NULL AND ${split.lineageSeedPredicate}
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE ${split.lineageStepPredicate}
),
cand AS (
  SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
         p.created_at, p.recorded_at, p.parent_id, l.depth AS lineage_depth
  FROM patches p
  JOIN lineage l ON p.patch_id = l.patch_id
  WHERE ${candWhere}${cursorCondition}
)`;

  if (mode === 'count') {
    return `${core} SELECT COUNT(*)::bigint AS cnt FROM cand`;
  }

  return `${core}
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id,
       (SELECT COUNT(*)::bigint FROM cand) AS total_count
FROM cand p
${orderSQL}${limitSql}`;
}

function patchBasedParams(
  split: LineageCandSplit,
  cursor: Cursor,
  limit: { sql: string; params: unknown[] }
): unknown[] {
  const head = split.useMatchingEntities ? [...split.snapParams] : [];
  return [
    ...head,
    ...split.lineageParams,
    ...split.candParams,
    ...cursor.params,
    ...limit.params,
  ];
}

function totalFromPatchBasedRows(
  rows: ReadonlyArray<PatchRow & { total_count: string | number }>
): number | null {
  if (rows.length === 0) return null;
  const raw = rows[0]!.total_count;
  return typeof raw === 'bigint' ? Number(raw) : Number(raw);
}

async function countPatchesForPatchBased(
  sqlClient: SqlClient,
  split: LineageCandSplit
): Promise<number> {
  const countSql = buildPatchBasedSql(split, '', '', '', 'count');
  const params = patchBasedParams(
    split,
    { condition: '', params: [] },
    {
      sql: '',
      params: [],
    }
  );
  assertWhereFragment(
    { sql: countSql, params },
    { context: 'countPatchesForPatchBased' }
  );
  const countRows = await sqlClient.query<{ cnt: string | number }>(
    countSql,
    params
  );
  const rawTotal = countRows[0]?.cnt ?? 0;
  return typeof rawTotal === 'bigint' ? Number(rawTotal) : Number(rawTotal);
}

async function resolveCursor(
  sqlClient: SqlClient,
  after: string
): Promise<Cursor> {
  const cursorRows = await sqlClient.query<{
    entity_id: string;
    entity_type: string;
    patch_id: string;
  }>(
    'SELECT entity_id, entity_type, patch_id FROM patches WHERE patch_id = ?',
    [after]
  );
  assert.ok(cursorRows.length > 0, 'Cursor patch not found', { after });
  const c = cursorRows[0];
  assert.ok(c !== null && c !== undefined, 'cursorRows[0] must exist', {
    after,
  });
  const depthRows = await sqlClient.query<{ depth: number }>(
    SELECT_DEPTH_BY_PATCH_ID,
    [after]
  );
  const cursorDepth = depthRows[0]?.depth ?? 0;
  return {
    condition:
      ' AND (p.entity_id, p.entity_type, l.depth, p.patch_id) > (?, ?, ?, ?)',
    params: [c.entity_id, c.entity_type, cursorDepth, c.patch_id],
  };
}

async function readOnePatchBased(
  sqlClient: SqlClient,
  query: PatchDbQuery
): Promise<PatchDbResult> {
  const { conditions: snapConditions, params: snapParams } =
    buildSnapshotConditions(query);
  const snapWhereSQL = snapConditions.join(' AND ');

  const split = buildLineageCandSplit(query, snapWhereSQL, snapParams);

  const cursor = query.after
    ? await resolveCursor(sqlClient, query.after)
    : { condition: '', params: [] as unknown[] };

  const defaultOrder =
    'ORDER BY p.entity_id ASC, p.entity_type ASC, p.lineage_depth ASC, p.patch_id ASC';
  const orderSQL = buildOrderSQL(query, defaultOrder, 'p.');
  const limit = buildLimitSQL(query);

  const selectSql = buildPatchBasedSql(
    split,
    cursor.condition,
    orderSQL,
    limit.sql,
    'select'
  );
  const allParams = patchBasedParams(split, cursor, limit);
  assertWhereFragment(
    { sql: selectSql, params: allParams },
    { context: 'readOnePatchBased' }
  );

  const rows = await sqlClient.query<
    PatchRow & { total_count: string | number }
  >(selectSql, allParams);

  const totalFromRows = totalFromPatchBasedRows(rows);
  const total =
    totalFromRows ?? (await countPatchesForPatchBased(sqlClient, split));

  const patches = rows.map((r) => toPatch(toPatchRow(r)));
  const hasMore = computeHasMore(query, patches.length, total);
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, total, hasMore, nextCursor };
}

function computeHasMore(
  query: PatchDbQuery,
  patchesLength: number,
  total: number
): boolean {
  if (query.after !== null && query.after !== undefined) {
    return (
      query.limit !== null &&
      query.limit !== undefined &&
      patchesLength >= query.limit
    );
  }
  if (query.limit !== null && query.limit !== undefined) {
    return (query.offset ?? 0) + patchesLength < total;
  }
  return false;
}

function computeOrderedEntityKeys(patches: readonly Patch[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const p of patches) {
    const key = `${p.entityId}\0${p.entityType}`;
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
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

export async function batchFetchSnapshots(
  sqlClient: SqlClient,
  entityKeys: string[]
): Promise<Entity[]> {
  if (entityKeys.length === 0) return [];
  const pairs = entityKeysToPairs(entityKeys);
  const placeholders = pairs.map(() => '(?, ?)').join(', ');
  const rows = await sqlClient.query<SnapshotRow>(
    `SELECT entity_id, entity_type, attributes::text AS attributes FROM snapshots WHERE (entity_type, entity_id) IN (VALUES ${placeholders})`,
    pairs.flatMap(([id, type]) => [type, id])
  );
  const map = new Map<string, SnapshotRow>();
  for (const row of rows) {
    map.set(`${row.entity_id}\0${row.entity_type}`, row);
  }
  const entities: Entity[] = [];
  for (const key of entityKeys) {
    const row = map.get(key);
    if (row) {
      entities.push(toEntity({ ...row, attributes: rowAttributesText(row) }));
    }
  }
  return entities;
}

function entityKeysToPairs(entityKeys: string[]): [string, string][] {
  return entityKeys.map((key) => {
    const parts = key.split('\0');
    assert.ok(
      parts.length === 2,
      'Entity key must contain exactly one null separator',
      { key }
    );
    const entityId = parts[0];
    const entityType = parts[1];
    assert.defined(entityId, 'entityId must be defined');
    assert.defined(entityType, 'entityType must be defined');
    return [entityId, entityType];
  });
}

async function batchFetchPatchesForEntities(
  sqlClient: SqlClient,
  entities: readonly { entity_id: string; entity_type: string }[],
  excludePatchIds?: readonly string[]
): Promise<Patch[]> {
  if (entities.length === 0) return [];
  const placeholders = entities.map(() => '(?, ?)').join(', ');
  const params = entities.flatMap((r) => [r.entity_id, r.entity_type]);
  const exclude =
    excludePatchIds !== undefined && excludePatchIds.length > 0
      ? excludePatchIds
      : null;
  const excludeSql =
    exclude !== null
      ? ` AND p.patch_id NOT IN (${exclude.map(() => '?').join(', ')})`
      : '';
  const allParams =
    exclude !== null
      ? [...params, ...params, ...exclude]
      : [...params, ...params];
  const sql = `WITH RECURSIVE lineage AS (
          SELECT patch_id, entity_id, entity_type, 0 AS depth
          FROM patches
          WHERE (entity_id, entity_type) IN (VALUES ${placeholders})
            AND parent_id IS NULL
          UNION ALL
          SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
          FROM patches p
          JOIN lineage l ON p.parent_id = l.patch_id
            AND p.entity_id = l.entity_id
            AND p.entity_type = l.entity_type
          WHERE (p.entity_id, p.entity_type) IN (VALUES ${placeholders})
      )
      SELECT p.patch_id, p.entity_id, p.entity_type,
             p.attributes::text AS attributes,
             p.created_at, p.recorded_at, p.parent_id
      FROM patches p
      JOIN lineage l ON p.patch_id = l.patch_id
      WHERE TRUE${excludeSql}
      ORDER BY p.entity_id, p.entity_type, l.depth ASC, p.patch_id ASC`;
  const patchRows = await sqlClient.query<PatchRow>(sql, allParams);
  return patchRows.map((r) => toPatch(toPatchRow(r)));
}

export { parseAttributes, rowAttributesText };
