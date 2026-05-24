import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PatchRow } from '../impl-sqlite/types';
import {
  assertEntityKey,
  isValidAttribute,
  PATCH_META_KEYS,
} from '../interface';
import { patchRowIsSyncRejected } from '../patch-row-sync-rejected';
import { partitionTableName } from './partitioning';
import { parseAttributes, rowAttributesText } from './read-ops';
import {
  deleteSnapshotsBatchSql,
  upsertSnapshotsBatchSql,
} from './sql-constants';

export function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

/** `(?, ?)` list duplicated in SQL; params are `[...pairs, ...pairs]`. */
export type SnapshotEntityPair = {
  entityId: string;
  entityType: string;
  key: string;
};

export function collectSnapshotEntityPairs(
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

export function groupSnapshotPatchRowsByKey(
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

export function buildSelectPatchesForSnapshotBatchSql(
  valuesPlaceholder: string
): string {
  return `WITH RECURSIVE lineage AS (
    SELECT patch_id, entity_id, entity_type, 0 AS depth
    FROM patches
    WHERE parent_id IS NULL AND (entity_id, entity_type) IN (VALUES ${valuesPlaceholder})
    UNION ALL
    SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
      AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
    WHERE (p.entity_id, p.entity_type) IN (VALUES ${valuesPlaceholder})
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
       p.created_at, p.recorded_at, p.parent_id
FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
  AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
WHERE (p.entity_id, p.entity_type) IN (VALUES ${valuesPlaceholder})
ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC`;
}

/** Reduces a patch chain into final snapshot attributes (nulls delete, later wins). */
export function mergePatchRowsIntoSnapshotAttrs(
  rows: readonly PatchRow[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    if (patchRowIsSyncRejected(row)) continue;
    const r = toPatchRow(row);
    const attrs = parseAttributes(r.attributes, {
      entity_id: r.entity_id,
      entity_type: r.entity_type,
      patch_id: r.patch_id,
    });
    for (const [key, value] of Object.entries(attrs)) {
      if (
        !isValidAttribute(key) ||
        (PATCH_META_KEYS as readonly string[]).includes(key)
      )
        continue;
      if (value === null) {
        delete merged[key];
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

type SnapshotUpsertRow = {
  entity_id: string;
  entity_type: string;
  attributes: Record<string, unknown>;
};

/** One DELETE / UPSERT batch targeted at a specific per-entity table.
 *  We route at the application layer because the `snapshots` view is
 *  read-only (no `INSTEAD OF` triggers); writes must hit the underlying
 *  per-entity standalone table, which is `snapshots__<slug>(entity_type)`. */
type PerEntityBatch = {
  readonly tableName: string;
  readonly deleteParams: unknown[];
  readonly upsertPayload: SnapshotUpsertRow[];
};

function getOrCreateBatch(
  batches: Map<string, PerEntityBatch>,
  entityType: string
): PerEntityBatch {
  const existing = batches.get(entityType);
  if (existing !== undefined) return existing;
  const created: PerEntityBatch = {
    tableName: partitionTableName(entityType),
    deleteParams: [],
    upsertPayload: [],
  };
  batches.set(entityType, created);
  return created;
}

function buildPerEntityBatches(
  entityPairs: readonly SnapshotEntityPair[],
  rowsByKey: ReadonlyMap<string, PatchRow[]>
): ReadonlyMap<string, PerEntityBatch> {
  const batches = new Map<string, PerEntityBatch>();
  for (const { entityId, entityType, key } of entityPairs) {
    const merged = mergePatchRowsIntoSnapshotAttrs(rowsByKey.get(key) ?? []);
    const batch = getOrCreateBatch(batches, entityType);
    if (Object.keys(merged).length === 0) {
      batch.deleteParams.push(entityId, entityType);
    } else {
      batch.upsertPayload.push({
        entity_id: entityId,
        entity_type: entityType,
        attributes: merged,
      });
    }
  }
  return batches;
}

async function runSnapshotDeletes(
  tx: SqlClient,
  tableName: string,
  deleteParams: readonly unknown[]
): Promise<void> {
  if (deleteParams.length === 0) return;
  const delPh = Array.from(
    { length: deleteParams.length / 2 },
    () => '(?, ?)'
  ).join(', ');
  await tx.run(deleteSnapshotsBatchSql(tableName, delPh), [...deleteParams]);
}

async function runSnapshotUpsertsBatch(
  tx: SqlClient,
  tableName: string,
  upsertPayload: readonly SnapshotUpsertRow[]
): Promise<void> {
  if (upsertPayload.length === 0) return;
  await tx.run(upsertSnapshotsBatchSql(tableName), [
    JSON.stringify(upsertPayload),
  ]);
}

async function applyPerEntityBatch(
  tx: SqlClient,
  batch: PerEntityBatch
): Promise<void> {
  await runSnapshotDeletes(tx, batch.tableName, batch.deleteParams);
  await runSnapshotUpsertsBatch(tx, batch.tableName, batch.upsertPayload);
}

/** Recomputes snapshots for every entity key in `touchedEntities` from the lineage of patches. */
export async function recomputeTouchedSnapshots(
  tx: SqlClient,
  touchedEntities: Set<string>
): Promise<void> {
  if (touchedEntities.size === 0) return;
  const entityPairs = collectSnapshotEntityPairs(touchedEntities);
  const valuesPh = entityPairs.map(() => '(?, ?)').join(', ');
  const pairParams = entityPairs.flatMap((p) => [p.entityId, p.entityType]);
  const patchRows = await tx.query<PatchRow>(
    buildSelectPatchesForSnapshotBatchSql(valuesPh),
    [...pairParams, ...pairParams, ...pairParams]
  );
  const rowsByKey = groupSnapshotPatchRowsByKey(patchRows);
  const batches = buildPerEntityBatches(entityPairs, rowsByKey);
  for (const batch of batches.values()) {
    await applyPerEntityBatch(tx, batch);
  }
}

export async function recomputeSnapshotSingle(
  tx: SqlClient,
  entityId: string,
  entityType: string
): Promise<void> {
  await recomputeTouchedSnapshots(tx, new Set([`${entityId}\0${entityType}`]));
}
