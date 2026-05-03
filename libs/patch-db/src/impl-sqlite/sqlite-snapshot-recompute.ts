import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  assertEntityKey,
  isValidAttribute,
  PATCH_META_KEYS,
} from '../interface';
import { patchRowIsSyncRejected } from '../patch-row-sync-rejected';
import { parseAttributes } from './mappers';
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

export async function recomputeTouchedSnapshots(
  tx: SqlClient,
  touchedEntities: Set<string>
): Promise<void> {
  for (const key of touchedEntities) {
    const parts = key.split('\0');
    assert.ok(
      parts.length === 2,
      'Entity key must contain exactly one null separator',
      { key }
    );
    const eid = parts[0];
    assert.defined(eid, 'Entity key must contain exactly one null separator');
    const et = parts[1];
    assert.defined(et, 'Entity key must contain exactly one null separator');
    await recomputeSnapshot(tx, eid, et);
  }
}
