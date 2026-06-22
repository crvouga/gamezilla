import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertWhereFragment } from '@pkgs/sql';
import type { Entity, Patch, PatchDbQuery, PatchDbResult } from '../interface';
import { hasMoreFromOverFetch, trimToRequestedLimit } from '../read-pagination';
import { entityIdTypeOrWhere } from './entity-pair-or-sql';
import { toEntity, toEntitySnapshotRowTrusted, toPatch } from './mappers';
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
  queries: PatchDbQuery[]
): Promise<PatchDbResult[]> {
  if (queries.length === 0) return [];
  /** Serialize reads: expo-sqlite web shares one worker; overlapping statements can finalize badly. */
  const out: PatchDbResult[] = [];
  for (const q of queries) {
    out.push(await readOne(sqlClient, q));
  }
  return out;
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
  const limit = buildLimitSQL(query, { overFetch: true });

  const sql = `SELECT p.* FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'sqlite.readOnePatchesMode' }
  );
  const rows = await sqlClient.query<PatchRow>(sql, allParams);

  const patches = trimToRequestedLimit(rows.map(toPatch), query);
  const hasMore = hasMoreFromOverFetch(query, rows.length);
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, hasMore, nextCursor };
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
  const limit = buildLimitSQL(query, { overFetch: true });

  const selectSql = `${LINEAGE_CTE},
cand AS (
  SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id,
         l.depth AS lineage_depth
  FROM patches p
  JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
  WHERE ${patchWhereSQL}${cursor.condition}
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id
FROM cand p
${orderSQL}${limit.sql}`;
  const allParams = [...patchParams, ...cursor.params, ...limit.params];
  assertWhereFragment(
    { sql: selectSql, params: allParams },
    { context: 'sqlite.readOnePatchBased' }
  );

  const rows = await sqlClient.query<PatchRow>(selectSql, allParams);

  const patches = trimToRequestedLimit(rows.map(toPatch), query);
  const hasMore = hasMoreFromOverFetch(query, rows.length);
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, hasMore, nextCursor };
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
  const limit = buildLimitSQL(query, { overFetch: true });

  const sql = `SELECT * FROM snapshots WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'sqlite.readOneSnapshotBased' }
  );
  const rows = await sqlClient.query<SnapshotRow>(sql, allParams);

  const entities = trimToRequestedLimit(rows.map(toEntity), query);
  const hasMore = hasMoreFromOverFetch(query, rows.length);

  const patches = await batchFetchPatchesForEntities(
    sqlClient,
    entities.map((e) => ({ entity_id: e.entityId, entity_type: e.entityType }))
  );

  return { query, entities, patches, hasMore, nextCursor: null };
}

/**
 * Full snapshot scan for in-memory UI hydration — no per-attribute keyword checks.
 */
export async function readAllSnapshotEntitiesForHydration(
  sqlClient: SqlClient
): Promise<Entity[]> {
  const rows = await sqlClient.query<SnapshotRow>(
    'SELECT * FROM snapshots ORDER BY entity_type ASC, entity_id ASC'
  );
  return rows.map((row) => toEntitySnapshotRowTrusted(row));
}

export async function batchFetchSnapshots(
  sqlClient: SqlClient,
  entityKeys: string[]
): Promise<Entity[]> {
  if (entityKeys.length === 0) return [];
  const pairs = entityKeysToPairs(entityKeys);
  const orWhere = entityIdTypeOrWhere('', pairs.length);
  const params = pairs.flatMap(([id, type]) => [id, type]);
  const rows = await sqlClient.query<SnapshotRow>(
    `SELECT * FROM snapshots WHERE ${orWhere}`,
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
  const orWhere = entityIdTypeOrWhere('p', entities.length);
  const params = entities.flatMap((r) => [r.entity_id, r.entity_type]);
  const patchRows = await sqlClient.query<PatchRow>(
    `WITH RECURSIVE lineage AS (
          SELECT p.patch_id, p.entity_id, p.entity_type, 0 AS depth
          FROM patches p
          WHERE p.parent_id IS NULL AND (${orWhere})
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
