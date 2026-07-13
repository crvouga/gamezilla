import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';

import { canonicalUserPair } from '../canonical-pair';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { pairId } from '../pair-id';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export async function friendshipExists(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT 1 AS ok FROM ${FRIENDSHIPS_TABLE.tableName}
     WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?
     LIMIT 1`,
    [userLow, userHigh]
  );
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${UserBlockCol.blockerId}, ${UserBlockCol.blockedId}
     FROM ${USER_BLOCKS_TABLE.tableName}
     WHERE (${UserBlockCol.blockerId} = ? AND ${UserBlockCol.blockedId} = ?)
        OR (${UserBlockCol.blockerId} = ? AND ${UserBlockCol.blockedId} = ?)
     LIMIT 1`,
    [userA, userB, userB, userA]
  );
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, UserBlockCol.blockerId);
  if (blockerId === userA) return 'by_a';
  return 'by_b';
}

export async function insertFriendship(
  sql: SqlClient,
  args: {
    readonly userA: string;
    readonly userB: string;
    readonly sourceRequestId: string;
    readonly now: string;
  }
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(args.userA, args.userB);
  await sql.run(
    `INSERT INTO ${FRIENDSHIPS_TABLE.tableName}
     (${FriendshipCol.id}, ${FriendshipCol.userLow}, ${FriendshipCol.userHigh},
      ${FriendshipCol.createdAt}, ${FriendshipCol.sourceRequestId})
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (${FriendshipCol.userLow}, ${FriendshipCol.userHigh}) DO NOTHING`,
    [
      pairId(userLow, userHigh),
      userLow,
      userHigh,
      args.now,
      args.sourceRequestId,
    ]
  );
}

export async function deleteFriendship(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await sql.run(
    `DELETE FROM ${FRIENDSHIPS_TABLE.tableName}
     WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?`,
    [userLow, userHigh]
  );
}

export async function insertBlock(
  sql: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await sql.run(
    `INSERT INTO ${USER_BLOCKS_TABLE.tableName}
     (${UserBlockCol.id}, ${UserBlockCol.blockerId}, ${UserBlockCol.blockedId}, ${UserBlockCol.createdAt})
     VALUES (?, ?, ?, ?)
     ON CONFLICT (${UserBlockCol.blockerId}, ${UserBlockCol.blockedId}) DO NOTHING`,
    [pairId(blockerId, blockedId), blockerId, blockedId, now]
  );
}

export async function deleteBlock(
  sql: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await sql.run(
    `DELETE FROM ${USER_BLOCKS_TABLE.tableName}
     WHERE ${UserBlockCol.blockerId} = ? AND ${UserBlockCol.blockedId} = ?`,
    [blockerId, blockedId]
  );
}
