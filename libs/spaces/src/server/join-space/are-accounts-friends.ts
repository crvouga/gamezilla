import type { SqlClient } from '@pkgs/sql-client/interface';

import { areAccountsFriendsInStore } from '../../shared/join-space/join-space-access';

export async function areAccountsFriends(
  sql: SqlClient,
  accountA: string,
  accountB: string
): Promise<boolean> {
  return areAccountsFriendsInStore(sql, accountA, accountB);
}
