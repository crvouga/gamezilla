import { assert } from '@gamezilla/assert';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { toEntity, toPatch } from '../impl-sqlite/mappers';
import type { PatchRow, SnapshotRow } from '../impl-sqlite/types';
import type { Entity, Patch, PatchDbQuery } from '../interface';

export function rowAttributesText(row: PatchRow | SnapshotRow): string {
  const a = row.attributes;
  if (typeof a === 'string') return a;
  return JSON.stringify(a);
}

export function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

export function computeHasMore(
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

export function computeOrderedEntityKeys(patches: readonly Patch[]): string[] {
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

export async function batchFetchPatchesForEntities(
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
