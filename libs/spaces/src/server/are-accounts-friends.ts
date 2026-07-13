import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { canonicalUserPair } from '../shared/canonical-user-pair';

export async function areAccountsFriends(
  sql: SqlClient,
  accountA: string,
  accountB: string
): Promise<boolean> {
  if (accountA.length === 0 || accountB.length === 0) return false;
  if (accountA === accountB) return true;
  const { userLow, userHigh } = canonicalUserPair(accountA, accountB);
  const rows = await sql.query<{ readonly id: string }>(
    `SELECT ${FriendshipCol.id} AS id
     FROM ${FRIENDSHIPS_TABLE.tableName}
     WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?
     LIMIT 1`,
    [userLow, userHigh]
  );
  return rows[0] !== undefined;
}
