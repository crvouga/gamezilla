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
import { LINEAGE_CTE, SELECT_DEPTH_BY_PATCH_ID } from './sql-constants';

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

function hasAtomPaginationDefaults(q: PatchDbQuery): boolean {
  if (q.after !== null && q.after !== undefined) return false;
  if (q.offset !== null && q.offset !== undefined && q.offset !== 0) return false;
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
  const allPatches = await batchFetchPatchesForEntities(sqlClient, pairs);
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
    const patchesOut = patchList.slice(0, 1);
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
    while (i < queries.length && canExtendBareSingleEntityBatch(queries, start, i)) {
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
  const isSingleEntityQuery = typeof query.entityId === 'string';
  if (query.on === 'patches') {
    return readOnePatchesMode(sqlClient, query);
  }
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

type PatchBasedFilter = { conditions: string[]; params: unknown[] };

function buildPatchBasedFilter(
  query: PatchDbQuery,
  snapWhereSQL: string,
  snapParams: unknown[]
): PatchBasedFilter {
  const hasSnapshotFilter = query.where !== null && query.where !== undefined;
  if (hasSnapshotFilter) {
    if (query.entityType !== null && query.entityType !== undefined) {
      return {
        conditions: [
          `p.entity_id IN (SELECT s.entity_id FROM snapshots s WHERE ${snapWhereSQL})`,
          'p.entity_type = ?',
        ],
        params: [...snapParams, query.entityType],
      };
    }
    return {
      conditions: [
        `(p.entity_id, p.entity_type) IN (SELECT s.entity_id, s.entity_type FROM snapshots s WHERE ${snapWhereSQL})`,
      ],
      params: [...snapParams],
    };
  }
  return buildPlainPatchFilter(query);
}

function buildPlainPatchFilter(query: PatchDbQuery): PatchBasedFilter {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push('p.entity_type = ?');
    params.push(query.entityType);
  }
  if (query.entityId !== null && query.entityId !== undefined) {
    if (Array.isArray(query.entityId)) {
      const placeholders = query.entityId.map(() => '?').join(', ');
      conditions.push(`p.entity_id IN (${placeholders})`);
      params.push(...query.entityId);
    } else {
      conditions.push('p.entity_id = ?');
      params.push(query.entityId);
    }
  }
  return { conditions, params };
}

type Cursor = { condition: string; params: unknown[] };

function buildPatchBasedCandSelectSql(
  patchWhereSQL: string,
  cursorCondition: string,
  orderSQL: string,
  limitSql: string
): string {
  return `${LINEAGE_CTE},
cand AS (
  SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
         p.created_at, p.recorded_at, p.parent_id, l.depth AS lineage_depth
  FROM patches p
  JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
  WHERE ${patchWhereSQL}${cursorCondition}
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id,
       (SELECT COUNT(*)::bigint FROM cand) AS total_count
FROM cand p
${orderSQL}${limitSql}`;
}

function totalFromPatchBasedRows(
  rows: ReadonlyArray<PatchRow & { total_count: string | number }>
): number | null {
  if (rows.length === 0) return null;
  const raw = rows[0]!.total_count;
  return typeof raw === 'bigint' ? Number(raw) : Number(raw);
}

async function countPatchesForPatchWhere(
  sqlClient: SqlClient,
  patchWhereSQL: string,
  patchParams: unknown[]
): Promise<number> {
  const countRows = await sqlClient.query<{ cnt: string | number }>(
    `SELECT COUNT(*)::bigint AS cnt FROM patches p WHERE ${patchWhereSQL}`,
    patchParams
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

  const filter = buildPatchBasedFilter(query, snapWhereSQL, snapParams);
  const patchConditions =
    filter.conditions.length === 0 ? ['1=1'] : filter.conditions;
  const patchParams = filter.params;

  const cursor = query.after
    ? await resolveCursor(sqlClient, query.after)
    : { condition: '', params: [] as unknown[] };

  const patchWhereSQL = patchConditions.join(' AND ');

  const defaultOrder =
    'ORDER BY p.entity_id ASC, p.entity_type ASC, p.lineage_depth ASC, p.patch_id ASC';
  const orderSQL = buildOrderSQL(query, defaultOrder, 'p.');
  const limit = buildLimitSQL(query);

  const selectSql = buildPatchBasedCandSelectSql(
    patchWhereSQL,
    cursor.condition,
    orderSQL,
    limit.sql
  );
  const allParams = [...patchParams, ...cursor.params, ...limit.params];
  assertWhereFragment(
    { sql: selectSql, params: allParams },
    { context: 'readOnePatchBased' }
  );

  const rows = await sqlClient.query<
    PatchRow & { total_count: string | number }
  >(selectSql, allParams);

  const totalFromRows = totalFromPatchBasedRows(rows);
  const total =
    totalFromRows ??
    (await countPatchesForPatchWhere(sqlClient, patchWhereSQL, patchParams));

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
  const params = pairs.flatMap(([id, type]) => [id, type]);
  const rows = await sqlClient.query<SnapshotRow>(
    `SELECT entity_id, entity_type, attributes::text AS attributes FROM snapshots WHERE (entity_id, entity_type) IN (VALUES ${placeholders})`,
    params
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
  entities: readonly { entity_id: string; entity_type: string }[]
): Promise<Patch[]> {
  if (entities.length === 0) return [];
  const placeholders = entities.map(() => '(?, ?)').join(', ');
  const params = entities.flatMap((r) => [r.entity_id, r.entity_type]);
  const patchRows = await sqlClient.query<PatchRow>(
    `WITH RECURSIVE lineage AS (
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
      )
      SELECT p.patch_id, p.entity_id, p.entity_type,
             p.attributes::text AS attributes,
             p.created_at, p.recorded_at, p.parent_id
      FROM patches p
      JOIN lineage l ON p.patch_id = l.patch_id
      ORDER BY p.entity_id, p.entity_type, l.depth ASC, p.patch_id ASC`,
    params
  );
  return patchRows.map((r) => toPatch(toPatchRow(r)));
}

export { parseAttributes, rowAttributesText };
