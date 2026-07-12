import type { SqlClient } from '@pkgs/sql-client/interface';

/** Loads active space ids for a caller via raw SQL (PowerSync upload auth). */
export async function loadMemberOfSpaceIdsFromSql(
  sql: SqlClient,
  myId: string
): Promise<string[]> {
  const rows = await sql.query<{ readonly space_id: string }>(
    `SELECT space_id FROM space_memberships
     WHERE guest_id = ? AND left_at IS NULL`,
    [myId]
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.space_id.length > 0) ids.add(row.space_id);
  }
  return [...ids];
}
