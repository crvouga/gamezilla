import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type {
  Entity,
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
} from '../interface';
import { toEntity, toPatch } from './mappers';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
} from './query-builder';
import { LINEAGE_CTE, SELECT_DEPTH_BY_PATCH_ID } from './sql-constants';
import type { PatchRow, SnapshotRow } from './types';

export async function readPatches(
  sqlClient: SqlClient,
  queries: PatchesDbQuery[]
): Promise<PatchesDbResult[]> {
  if (queries.length === 0) return [];
  /** Sequential: each PGlite-HTTP / Neon query is a Worker subrequest when used from the API. */
  const results: PatchesDbResult[] = [];
  for (const q of queries) {
    results.push(await readOne(sqlClient, q));
  }
  return results;
}

async function readOne(
  sqlClient: SqlClient,
  query: PatchesDbQuery
): Promise<PatchesDbResult> {
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
  query: PatchesDbQuery
): Promise<PatchesDbResult> {
  const { conditions, params } = buildPatchConditions(query, 'p');
  const whereSQL = conditions.join(' AND ');

  const orderSQL = buildOrderSQL(query, 'ORDER BY p.patch_id ASC', 'p.');
  const limit = buildLimitSQL(query);

  const rows = await sqlClient.query<PatchRow & { total_count: number }>(
    `SELECT p.*, COUNT(*) OVER() AS total_count FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
    [...params, ...limit.params]
  );

  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
  const patches = rows.map(toPatch);
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
  query: PatchesDbQuery,
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

function buildPlainPatchFilter(query: PatchesDbQuery): PatchBasedFilter {
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

async function resolveCursor(
  sqlClient: SqlClient,
  after: string
): Promise<Cursor> {
  const cursorRows = await sqlClient.query<{
    entity_id: string;
    entity_type: string;
    patch_id: string;
  }>('SELECT entity_id, entity_type, patch_id FROM patches WHERE patch_id = ?', [
    after,
  ]);
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
  query: PatchesDbQuery
): Promise<PatchesDbResult> {
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

  const selectSql = `${LINEAGE_CTE},
cand AS (
  SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id,
         l.depth AS lineage_depth
  FROM patches p
  JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
  WHERE ${patchWhereSQL}${cursor.condition}
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id,
       (SELECT COUNT(*) FROM cand) AS total_count
FROM cand p
${orderSQL}${limit.sql}`;

  const rows = await sqlClient.query<PatchRow & { total_count: number }>(
    selectSql,
    [...patchParams, ...cursor.params, ...limit.params]
  );

  let total: number;
  if (rows.length > 0) {
    total = Number(rows[0]!.total_count);
  } else {
    const countRows = await sqlClient.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM patches p WHERE ${patchWhereSQL}`,
      patchParams
    );
    total = countRows[0]?.cnt ?? 0;
  }

  const patches = rows.map(toPatch);
  const hasMore = computeHasMore(query, patches.length, total);
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, total, hasMore, nextCursor };
}

function computeHasMore(
  query: PatchesDbQuery,
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
  query: PatchesDbQuery
): Promise<PatchesDbResult> {
  const { conditions, params } = buildSnapshotConditions(query);
  const whereSQL = conditions.join(' AND ');

  const orderSQL = buildOrderSQL(query, 'ORDER BY entity_id ASC');
  const limit = buildLimitSQL(query);

  const rows = await sqlClient.query<SnapshotRow & { total_count: number }>(
    `SELECT *, COUNT(*) OVER() AS total_count FROM snapshots WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
    [...params, ...limit.params]
  );

  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
  const entities = rows.map(toEntity);
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
    `SELECT * FROM snapshots WHERE (entity_id, entity_type) IN (VALUES ${placeholders})`,
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
      entities.push(toEntity(row));
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
      SELECT p.*
      FROM patches p
      JOIN lineage l ON p.patch_id = l.patch_id
      ORDER BY p.entity_id, p.entity_type, l.depth ASC, p.patch_id ASC`,
    params
  );
  return patchRows.map(toPatch);
}
