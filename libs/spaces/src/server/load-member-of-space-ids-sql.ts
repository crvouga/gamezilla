import type { SqlClient } from '@pkgs/sql-client/interface';

type SpaceIdRow = { readonly id: string };

/** Loads active space ids for a caller via raw SQL (PowerSync upload auth). */
export async function loadMemberOfSpaceIdsFromSql(
  sql: SqlClient,
  myId: string
): Promise<string[]> {
  const hosted = await sql.query<SpaceIdRow>(
    `SELECT id FROM spaces WHERE host_id = ? AND ended_at IS NULL`,
    [myId]
  );
  const guest = await sql.query<{ readonly space_id: string }>(
    `SELECT space_id FROM space_memberships
     WHERE guest_id = ? AND left_at IS NULL`,
    [myId]
  );
  const ids = new Set<string>();
  for (const row of hosted) {
    if (row.id.length > 0) ids.add(row.id);
  }
  for (const row of guest) {
    if (row.space_id.length > 0) ids.add(row.space_id);
  }
  return [...ids];
}
