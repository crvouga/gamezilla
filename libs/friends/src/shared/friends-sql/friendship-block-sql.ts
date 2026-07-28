import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql } from '@pkgs/sql';

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
    SELECT 1 AS ok FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
    WHERE ${raw(FriendshipCol.userLow)} = ${userLow} AND ${raw(FriendshipCol.userHigh)} = ${userHigh}
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
    SELECT ${raw(UserBlockCol.blockerId)}, ${raw(UserBlockCol.blockedId)}
    FROM ${raw(USER_BLOCKS_TABLE.tableName)}
    WHERE (${raw(UserBlockCol.blockerId)} = ${userA} AND ${raw(UserBlockCol.blockedId)} = ${userB})
       OR (${raw(UserBlockCol.blockerId)} = ${userB} AND ${raw(UserBlockCol.blockedId)} = ${userA})
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
    INSERT INTO ${raw(FRIENDSHIPS_TABLE.tableName)}
    (${raw(FriendshipCol.id)}, ${raw(FriendshipCol.userLow)}, ${raw(FriendshipCol.userHigh)},
     ${raw(FriendshipCol.createdAt)}, ${raw(FriendshipCol.sourceRequestId)})
    VALUES (${pairId(userLow, userHigh)}, ${userLow}, ${userHigh}, ${args.now}, ${args.sourceRequestId})
    ON CONFLICT (${raw(FriendshipCol.userLow)}, ${raw(FriendshipCol.userHigh)}) DO NOTHING
  `);
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(sql`
    DELETE FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
    WHERE ${raw(FriendshipCol.userLow)} = ${userLow} AND ${raw(FriendshipCol.userHigh)} = ${userHigh}
  `);
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql`
    INSERT INTO ${raw(USER_BLOCKS_TABLE.tableName)}
    (${raw(UserBlockCol.id)}, ${raw(UserBlockCol.blockerId)}, ${raw(UserBlockCol.blockedId)}, ${raw(UserBlockCol.createdAt)})
    VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now})
    ON CONFLICT (${raw(UserBlockCol.blockerId)}, ${raw(UserBlockCol.blockedId)}) DO NOTHING
  `);
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM ${raw(USER_BLOCKS_TABLE.tableName)}
    WHERE ${raw(UserBlockCol.blockerId)} = ${blockerId} AND ${raw(UserBlockCol.blockedId)} = ${blockedId}
  `);
}
