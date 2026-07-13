import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendRequestCol,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { canonicalUserPair } from '../shared/canonical-pair';
import { pairId } from '../shared/pair-id';
import type {
  FriendRequest,
  FriendRequestStatus,
} from '../shared/friends-types';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function readNullableString(
  row: Record<string, unknown>,
  key: string
): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function mapFriendRequest(row: Record<string, unknown>): FriendRequest {
  const status = readString(row, FriendRequestCol.status);
  return {
    id: readString(row, FriendRequestCol.id),
    fromUserId: readString(row, FriendRequestCol.fromUserId),
    toUserId: readString(row, FriendRequestCol.toUserId),
    status: status as FriendRequestStatus,
    message: readNullableString(row, FriendRequestCol.message),
    createdAt: readString(row, FriendRequestCol.createdAt),
    updatedAt: readString(row, FriendRequestCol.updatedAt),
    respondedAt: readNullableString(row, FriendRequestCol.respondedAt),
  };
}

export async function findFriendRequestById(
  sql: SqlClient,
  requestId: string
): Promise<FriendRequest | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.id} = ?
     LIMIT 1`,
    [requestId]
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestBetween(
  sql: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.fromUserId} = ?
       AND ${FriendRequestCol.toUserId} = ?
       AND ${FriendRequestCol.status} = 'pending'
     LIMIT 1`,
    [fromUserId, toUserId]
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestsBetweenPair(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<readonly FriendRequest[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.status} = 'pending'
       AND (
         (${FriendRequestCol.fromUserId} = ? AND ${FriendRequestCol.toUserId} = ?)
         OR (${FriendRequestCol.fromUserId} = ? AND ${FriendRequestCol.toUserId} = ?)
       )`,
    [userA, userB, userB, userA]
  );
  return rows.map(mapFriendRequest);
}

export async function findLatestDeclinedRequestBetween(
  sql: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.fromUserId} = ?
       AND ${FriendRequestCol.toUserId} = ?
       AND ${FriendRequestCol.status} = 'declined'
     ORDER BY ${FriendRequestCol.respondedAt} DESC NULLS LAST
     LIMIT 1`,
    [fromUserId, toUserId]
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
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

export async function insertFriendRequest(
  sql: SqlClient,
  args: {
    readonly id: string;
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly message: string | null;
    readonly now: string;
  }
): Promise<FriendRequest> {
  await sql.run(
    `INSERT INTO ${FRIEND_REQUESTS_TABLE.tableName}
     (${FriendRequestCol.id}, ${FriendRequestCol.fromUserId}, ${FriendRequestCol.toUserId},
      ${FriendRequestCol.status}, ${FriendRequestCol.message},
      ${FriendRequestCol.createdAt}, ${FriendRequestCol.updatedAt})
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    [args.id, args.fromUserId, args.toUserId, args.message, args.now, args.now]
  );
  const created = await findFriendRequestById(sql, args.id);
  if (created === null) {
    throw new Error('friend request insert failed');
  }
  return created;
}

export async function markFriendRequestStatus(
  sql: SqlClient,
  requestId: string,
  status: FriendRequestStatus,
  now: string
): Promise<void> {
  await sql.run(
    `UPDATE ${FRIEND_REQUESTS_TABLE.tableName}
     SET ${FriendRequestCol.status} = ?,
         ${FriendRequestCol.updatedAt} = ?,
         ${FriendRequestCol.respondedAt} = ?
     WHERE ${FriendRequestCol.id} = ?`,
    [status, now, now, requestId]
  );
}

export async function cancelPendingRequestsBetween(
  sql: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  await sql.run(
    `UPDATE ${FRIEND_REQUESTS_TABLE.tableName}
     SET ${FriendRequestCol.status} = 'cancelled',
         ${FriendRequestCol.updatedAt} = ?,
         ${FriendRequestCol.respondedAt} = ?
     WHERE ${FriendRequestCol.status} = 'pending'
       AND (
         (${FriendRequestCol.fromUserId} = ? AND ${FriendRequestCol.toUserId} = ?)
         OR (${FriendRequestCol.fromUserId} = ? AND ${FriendRequestCol.toUserId} = ?)
       )`,
    [now, now, userA, userB, userB, userA]
  );
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

export async function upsertFriendProfileCache(
  sql: SqlClient,
  args: {
    readonly ownerId: string;
    readonly friendId: string;
    readonly username: string;
    readonly avatarConfig: string | null;
    readonly now: string;
  }
): Promise<void> {
  await sql.run(
    `INSERT INTO ${FRIEND_PROFILE_CACHE_TABLE.tableName}
     (${FriendProfileCacheCol.id}, ${FriendProfileCacheCol.ownerId}, ${FriendProfileCacheCol.friendId},
      ${FriendProfileCacheCol.username},
      ${FriendProfileCacheCol.avatarConfig}, ${FriendProfileCacheCol.updatedAt})
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (${FriendProfileCacheCol.ownerId}, ${FriendProfileCacheCol.friendId}) DO UPDATE SET
       ${FriendProfileCacheCol.username} = excluded.${FriendProfileCacheCol.username},
       ${FriendProfileCacheCol.avatarConfig} = excluded.${FriendProfileCacheCol.avatarConfig},
       ${FriendProfileCacheCol.updatedAt} = excluded.${FriendProfileCacheCol.updatedAt}`,
    [
      pairId(args.ownerId, args.friendId),
      args.ownerId,
      args.friendId,
      args.username,
      args.avatarConfig,
      args.now,
    ]
  );
}

export async function deleteFriendProfileCachePair(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await sql.run(
    `DELETE FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName}
     WHERE (${FriendProfileCacheCol.ownerId} = ? AND ${FriendProfileCacheCol.friendId} = ?)
        OR (${FriendProfileCacheCol.ownerId} = ? AND ${FriendProfileCacheCol.friendId} = ?)`,
    [userA, userB, userB, userA]
  );
}

export async function listMutualFriendIds(
  sql: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<readonly string[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `WITH my_friends AS (
       SELECT CASE
         WHEN ${FriendshipCol.userLow} = ? THEN ${FriendshipCol.userHigh}
         ELSE ${FriendshipCol.userLow}
       END AS friend_id
       FROM ${FRIENDSHIPS_TABLE.tableName}
       WHERE ${FriendshipCol.userLow} = ? OR ${FriendshipCol.userHigh} = ?
     ),
     their_friends AS (
       SELECT CASE
         WHEN ${FriendshipCol.userLow} = ? THEN ${FriendshipCol.userHigh}
         ELSE ${FriendshipCol.userLow}
       END AS friend_id
       FROM ${FRIENDSHIPS_TABLE.tableName}
       WHERE ${FriendshipCol.userLow} = ? OR ${FriendshipCol.userHigh} = ?
     )
     SELECT mf.friend_id
     FROM my_friends mf
     INNER JOIN their_friends tf ON mf.friend_id = tf.friend_id
     LIMIT 50`,
    [viewerId, viewerId, viewerId, targetUserId, targetUserId, targetUserId]
  );
  return rows
    .map((row) => readString(row, 'friend_id'))
    .filter((id) => id.length > 0);
}
