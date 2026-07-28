import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';

/**
 * Loads active space ids for a member (account or anon device) via raw SQL
 * (PowerSync upload auth / write context).
 */
export async function loadMemberOfSpaceIdsFromSql(
  db: SqlClient,
  memberId: string
): Promise<string[]> {
  const rows = await db.query<{ readonly space_id: string }>(
    honey({
      select: ['space_id'],
      from: 'space_memberships',
      where: ['and', ['=', 'member_id', memberId], ['is-null', 'left_at']],
    })
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.space_id.length > 0) ids.add(row.space_id);
  }
  return [...ids];
}
