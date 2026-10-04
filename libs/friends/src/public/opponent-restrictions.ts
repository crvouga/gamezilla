import { join, sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

/** Only the pairing decision reads these facts; callers never disclose blocks. */
export async function opponentRestrictions(
  tx: SqlTx,
  owners: readonly string[]
): Promise<readonly (readonly [string, string])[]> {
  if (owners.length < 2) return [];
  const rows = await tx.query(sql<{ blocker_id: string; blocked_id: string }>`
    SELECT blocker_id, blocked_id FROM friends_blocks
    WHERE deleted_at IS NULL AND blocker_id IN (${join([...owners])})
      AND blocked_id IN (${join([...owners])})`);
  return rows.map((row) => [row.blocker_id, row.blocked_id] as const);
}
