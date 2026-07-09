import type { SqlClient } from '@pkgs/sql-client/interface';

import { loadMemberOfSpaceIdsFromSql } from './load-member-of-space-ids-sql';

export async function loadMemberOfSpaceIds(
  sql: SqlClient,
  myId: string
): Promise<string[]> {
  return loadMemberOfSpaceIdsFromSql(sql, myId);
}
