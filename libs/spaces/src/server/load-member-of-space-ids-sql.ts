import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Loads space ids the member may access via space_users ACL
 * (PowerSync upload auth / write context).
 */
export async function loadMemberOfSpaceIdsFromSql(
  db: SqlClient,
  memberId: string
): Promise<string[]> {
  const rows = await db.query<{ readonly space_id: string }>(
    sqlMap({
      select: ['space_id'],
      from: 'space_users',
      where: ['=', 'user_id', memberId],
    })
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.space_id.length > 0) ids.add(row.space_id);
  }
  return [...ids];
}
