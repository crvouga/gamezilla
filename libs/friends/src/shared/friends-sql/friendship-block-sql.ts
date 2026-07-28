import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { sql, ident } from '@pkgs/sql';

import { canonicalUserPair } from '../canonical-pair';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { pairId } from '../pair-id';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export async function friendshipExists(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT 1 AS ok FROM ${ident(FRIENDSHIPS_TABLE.tableName)}
    WHERE ${ident(FriendshipCol.userLow)} = ${userLow} AND ${ident(FriendshipCol.userHigh)} = ${userHigh}
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT ${ident(UserBlockCol.blockerId)}, ${ident(UserBlockCol.blockedId)}
    FROM ${ident(USER_BLOCKS_TABLE.tableName)}
    WHERE (${ident(UserBlockCol.blockerId)} = ${userA} AND ${ident(UserBlockCol.blockedId)} = ${userB})
       OR (${ident(UserBlockCol.blockerId)} = ${userB} AND ${ident(UserBlockCol.blockedId)} = ${userA})
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, UserBlockCol.blockerId);
  if (blockerId === userA) return 'by_a';
  return 'by_b';
}

export async function insertFriendship(
  db: SqlClient,
  args: {
    readonly userA: string;
    readonly userB: string;
    readonly sourceRequestId: string;
    readonly now: string;
  }
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(args.userA, args.userB);
  await db.run(sql`
    INSERT INTO ${ident(FRIENDSHIPS_TABLE.tableName)}
    (${ident(FriendshipCol.id)}, ${ident(FriendshipCol.userLow)}, ${ident(FriendshipCol.userHigh)},
     ${ident(FriendshipCol.createdAt)}, ${ident(FriendshipCol.sourceRequestId)})
    VALUES (${pairId(userLow, userHigh)}, ${userLow}, ${userHigh}, ${args.now}, ${args.sourceRequestId})
    ON CONFLICT (${ident(FriendshipCol.userLow)}, ${ident(FriendshipCol.userHigh)}) DO NOTHING
  `);
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(sql`
    DELETE FROM ${ident(FRIENDSHIPS_TABLE.tableName)}
    WHERE ${ident(FriendshipCol.userLow)} = ${userLow} AND ${ident(FriendshipCol.userHigh)} = ${userHigh}
  `);
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql`
    INSERT INTO ${ident(USER_BLOCKS_TABLE.tableName)}
    (${ident(UserBlockCol.id)}, ${ident(UserBlockCol.blockerId)}, ${ident(UserBlockCol.blockedId)}, ${ident(UserBlockCol.createdAt)})
    VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now})
    ON CONFLICT (${ident(UserBlockCol.blockerId)}, ${ident(UserBlockCol.blockedId)}) DO NOTHING
  `);
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM ${ident(USER_BLOCKS_TABLE.tableName)}
    WHERE ${ident(UserBlockCol.blockerId)} = ${blockerId} AND ${ident(UserBlockCol.blockedId)} = ${blockedId}
  `);
}
