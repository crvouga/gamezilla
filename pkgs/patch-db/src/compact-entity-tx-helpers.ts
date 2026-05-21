import { assert } from '@gamezilla/assert';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import type { PatchRow } from './impl-sqlite/types';

const SQL_LINK_COMPACTION_TO_FIRST_KEPT = `UPDATE patches SET parent_id = ? WHERE patch_id = ?`;
const SQL_DELETE_PATCH_BY_ID = `DELETE FROM patches WHERE patch_id = ?`;

/** Point the first kept row’s parent at the new compaction patch. */
export async function linkCompactionPatchToFirstKept(
  tx: SqlClient,
  compactionPatchId: string,
  firstKeptPatchId: string
): Promise<void> {
  await tx.run(SQL_LINK_COMPACTION_TO_FIRST_KEPT, [
    compactionPatchId,
    firstKeptPatchId,
  ]);
}

export type RepointOrphansArgs = {
  tx: SqlClient;
  compactionPatchId: string;
  entityId: string;
  entityType: string;
  mergeSetIds: readonly string[];
};

/** Repoint rows whose parent was merged away but are not themselves in mergeSet. */
export async function repointOrphansOutsideMergeSet(
  args: RepointOrphansArgs
): Promise<void> {
  const { tx, compactionPatchId, entityId, entityType, mergeSetIds } = args;
  if (mergeSetIds.length === 0) return;
  const ph = mergeSetIds.map(() => '?').join(', ');
  await tx.run(
    `UPDATE patches SET parent_id = ? WHERE entity_id = ? AND entity_type = ? AND parent_id IN (${ph}) AND patch_id NOT IN (${ph})`,
    [compactionPatchId, entityId, entityType, ...mergeSetIds, ...mergeSetIds]
  );
}

export async function deleteMergeSetReverse(
  tx: SqlClient,
  mergeSet: readonly PatchRow[]
): Promise<string[]> {
  const removedPatchIds: string[] = [];
  for (let i = mergeSet.length - 1; i >= 0; i--) {
    const row = mergeSet[i];
    assert.defined(row, 'mergeSet row');
    await tx.run(SQL_DELETE_PATCH_BY_ID, [row.patch_id]);
    removedPatchIds.push(row.patch_id);
  }
  return removedPatchIds;
}

/** Chain compaction patch, fix FK orphans, delete merged rows (reverse order). */
export async function finishCompactionAfterInsert(
  tx: SqlClient,
  args: {
    compactionPatchId: string;
    entityId: string;
    entityType: string;
    mergeSet: readonly PatchRow[];
    firstKeptPatchId: string;
  }
): Promise<string[]> {
  const {
    compactionPatchId,
    entityId,
    entityType,
    mergeSet,
    firstKeptPatchId,
  } = args;
  await linkCompactionPatchToFirstKept(tx, compactionPatchId, firstKeptPatchId);
  const mergeSetIds = mergeSet.map((r) => r.patch_id);
  await repointOrphansOutsideMergeSet({
    tx,
    compactionPatchId,
    entityId,
    entityType,
    mergeSetIds,
  });
  return deleteMergeSetReverse(tx, mergeSet);
}
