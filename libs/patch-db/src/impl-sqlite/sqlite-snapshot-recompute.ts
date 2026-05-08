import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  assertEntityKey,
  isValidAttribute,
  PATCH_META_KEYS,
} from '../interface';
import { patchRowIsSyncRejected } from '../patch-row-sync-rejected';
import { parseAttributes } from './mappers';
import { entityIdTypeOrWhere } from './entity-pair-or-sql';
import {
  DELETE_SNAPSHOT,
  SELECT_PATCHES_FOR_SNAPSHOT,
  UPSERT_SNAPSHOT,
} from './sql-constants';
import type { PatchRow } from './types';

export function mergePatchRowsIntoMergedRecord(
  rows: readonly PatchRow[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    if (patchRowIsSyncRejected(row)) continue;
    const attrs = parseAttributes(row.attributes, {
      entity_id: row.entity_id,
      entity_type: row.entity_type,
      patch_id: row.patch_id,
    });
    for (const [key, value] of Object.entries(attrs)) {
      if (!isValidAttribute(key) || PATCH_META_KEYS.includes(key)) continue;
      if (value === null) {
        delete merged[key];
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

type SnapshotEntityPair = {
  entityId: string;
  entityType: string;
  key: string;
};

function collectSnapshotEntityPairs(
  touchedEntities: Set<string>
): SnapshotEntityPair[] {
  const entityPairs: SnapshotEntityPair[] = [];
  for (const key of touchedEntities) {
    const parts = key.split('\0');
    assert.ok(
      parts.length === 2,
      'Entity key must contain exactly one null separator',
      { key }
    );
    const entityId = parts[0];
    const entityType = parts[1];
    assert.defined(
      entityId,
      'Entity key must contain exactly one null separator'
    );
    assert.defined(
      entityType,
      'Entity key must contain exactly one null separator'
    );
    assertEntityKey(entityId, entityType);
    entityPairs.push({ entityId, entityType, key });
  }
  return entityPairs;
}

function groupSnapshotPatchRowsByKey(
  rows: PatchRow[]
): Map<string, PatchRow[]> {
  const rowsByKey = new Map<string, PatchRow[]>();
  for (const row of rows) {
    const k = `${row.entity_id}\0${row.entity_type}`;
    const list = rowsByKey.get(k);
    if (list !== undefined) {
      list.push(row);
    } else {
      rowsByKey.set(k, [row]);
    }
  }
  return rowsByKey;
}

function buildSelectPatchesForSnapshotBatchSqlSqlite(
  pairCount: number
): string {
  const roots = entityIdTypeOrWhere('p', pairCount);
  const rowFilter = entityIdTypeOrWhere('p', pairCount);
  return `WITH RECURSIVE lineage AS (
    SELECT p.patch_id, p.entity_id, p.entity_type, 0 AS depth
    FROM patches p
    WHERE p.parent_id IS NULL AND (${roots})
    UNION ALL
    SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
      AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes,
       p.created_at, p.recorded_at, p.parent_id
FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
  AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
WHERE (${rowFilter})
ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC`;
}

async function runSnapshotDeletes(
  tx: SqlClient,
  deleteParams: unknown[]
): Promise<void> {
  if (deleteParams.length === 0) return;
  const delOr = entityIdTypeOrWhere('', deleteParams.length / 2);
  await tx.run(`DELETE FROM snapshots WHERE ${delOr}`, deleteParams);
}

async function runSnapshotUpsertsSqlite(
  tx: SqlClient,
  upserts: readonly {
    entity_id: string;
    entity_type: string;
    merged: Record<string, unknown>;
  }[]
): Promise<void> {
  for (const u of upserts) {
    await tx.run(UPSERT_SNAPSHOT, [
      u.entity_id,
      u.entity_type,
      JSON.stringify(u.merged),
    ]);
  }
}

export async function recomputeSnapshot(
  tx: SqlClient,
  entityId: string,
  entityType: string
): Promise<void> {
  assertEntityKey(entityId, entityType);
  const rows = await tx.query<PatchRow>(SELECT_PATCHES_FOR_SNAPSHOT, [
    entityId,
    entityType,
    entityId,
    entityType,
    entityId,
    entityType,
  ]);

  const merged = mergePatchRowsIntoMergedRecord(rows);

  if (Object.keys(merged).length === 0) {
    await tx.run(DELETE_SNAPSHOT, [entityId, entityType]);
  } else {
    await tx.run(UPSERT_SNAPSHOT, [
      entityId,
      entityType,
      JSON.stringify(merged),
    ]);
  }
}

async function recomputeTouchedSingleKey(
  tx: SqlClient,
  key: string
): Promise<void> {
  const parts = key.split('\0');
  assert.ok(
    parts.length === 2,
    'Entity key must contain exactly one null separator',
    { key }
  );
  const eid = parts[0];
  const et = parts[1];
  assert.defined(eid, 'entityId must exist');
  assert.defined(et, 'entityType must exist');
  await recomputeSnapshot(tx, eid, et);
}

type SnapshotUpsertRow = {
  entity_id: string;
  entity_type: string;
  merged: Record<string, unknown>;
};

function partitionSnapshotDeletesAndUpserts(
  entityPairs: SnapshotEntityPair[],
  rowsByKey: Map<string, PatchRow[]>
): { deleteParams: unknown[]; upserts: SnapshotUpsertRow[] } {
  const deleteParams: unknown[] = [];
  const upserts: SnapshotUpsertRow[] = [];
  for (const { entityId, entityType, key } of entityPairs) {
    const merged = mergePatchRowsIntoMergedRecord(rowsByKey.get(key) ?? []);
    if (Object.keys(merged).length === 0) {
      deleteParams.push(entityId, entityType);
    } else {
      upserts.push({ entity_id: entityId, entity_type: entityType, merged });
    }
  }
  return { deleteParams, upserts };
}

async function recomputeTouchedSnapshotsBatch(
  tx: SqlClient,
  touchedEntities: Set<string>
): Promise<void> {
  const entityPairs = collectSnapshotEntityPairs(touchedEntities);
  const pairParams = entityPairs.flatMap((p) => [p.entityId, p.entityType]);
  const sql = buildSelectPatchesForSnapshotBatchSqlSqlite(entityPairs.length);
  const patchRows = await tx.query<PatchRow>(sql, [
    ...pairParams,
    ...pairParams,
  ]);
  const rowsByKey = groupSnapshotPatchRowsByKey(patchRows);
  const { deleteParams, upserts } = partitionSnapshotDeletesAndUpserts(
    entityPairs,
    rowsByKey
  );
  await runSnapshotDeletes(tx, deleteParams);
  await runSnapshotUpsertsSqlite(tx, upserts);
}

/** Recomputes snapshots for every entity key in `touchedEntities` from patch lineages (one batched read + batched deletes + per-row upserts). */
export async function recomputeTouchedSnapshots(
  tx: SqlClient,
  touchedEntities: Set<string>
): Promise<void> {
  if (touchedEntities.size === 0) return;
  if (touchedEntities.size === 1) {
    const key = [...touchedEntities][0];
    assert.defined(key, 'touchedEntities must be non-empty');
    await recomputeTouchedSingleKey(tx, key);
    return;
  }
  await recomputeTouchedSnapshotsBatch(tx, touchedEntities);
}
