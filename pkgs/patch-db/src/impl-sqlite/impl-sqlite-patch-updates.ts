import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertWhereFragment } from '@pkgs/sql';
import { assertAttribute, assertPatchId } from '../interface';
import { buildSqliteUpdateJsonSet } from './update-ops';

export async function distinctEntityKeysForPatchIds(
  sqlClient: SqlClient,
  patchIds: readonly string[]
): Promise<Set<string>> {
  if (patchIds.length === 0) return new Set();
  const ph = patchIds.map(() => '?').join(', ');
  const rows = await sqlClient.query<{
    entity_id: string;
    entity_type: string;
  }>(
    `SELECT DISTINCT entity_id, entity_type FROM patches WHERE patch_id IN (${ph})`,
    [...patchIds]
  );
  const keys = new Set<string>();
  for (const r of rows) {
    keys.add(`${r.entity_id}\0${r.entity_type}`);
  }
  return keys;
}

export async function applyPatchUpdatesAndCollectTouchedIds(
  sqlClient: SqlClient,
  updates: { patchId: string; attributes: Record<string, unknown> }[]
): Promise<string[]> {
  const touchedPatchIds: string[] = [];
  for (const { patchId, attributes } of updates) {
    assertPatchId(patchId);
    if (Object.keys(attributes).length === 0) continue;
    for (const key of Object.keys(attributes)) {
      assertAttribute(key);
    }
    const { expr, params } = buildSqliteUpdateJsonSet(attributes);
    const sql = `UPDATE patches SET attributes = ${expr} WHERE patch_id = ?`;
    assertWhereFragment(
      { sql, params: [...params, patchId] },
      { context: 'PatchDbImplSqlite.update' }
    );
    await sqlClient.run(sql, [...params, patchId]);
    touchedPatchIds.push(patchId);
  }
  return touchedPatchIds;
}
