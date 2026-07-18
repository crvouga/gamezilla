import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Loads active space ids for a member (account or anon device) via raw SQL
 * (PowerSync upload auth / write context).
 */
export async function loadMemberOfSpaceIdsFromSql(
  sql: SqlClient,
  memberId: string
): Promise<string[]> {
  const rows = await sql.query<{ readonly space_id: string }>(
    `SELECT space_id FROM space_memberships
     WHERE member_id = ? AND left_at IS NULL`,
    [memberId]
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.space_id.length > 0) ids.add(row.space_id);
  }
  return [...ids];
}
