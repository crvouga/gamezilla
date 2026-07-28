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
import { raw, sql } from '@pkgs/sql';
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
  db: SqlClient,
  requestId: string
): Promise<FriendRequest | null> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT * FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${raw(FriendRequestCol.id)} = ${requestId}
    LIMIT 1
  `);
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestBetween(
  db: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT * FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${raw(FriendRequestCol.fromUserId)} = ${fromUserId}
      AND ${raw(FriendRequestCol.toUserId)} = ${toUserId}
      AND ${raw(FriendRequestCol.status)} = 'pending'
    LIMIT 1
  `);
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestsBetweenPair(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT * FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${raw(FriendRequestCol.status)} = 'pending'
      AND (
        (${raw(FriendRequestCol.fromUserId)} = ${userA} AND ${raw(FriendRequestCol.toUserId)} = ${userB})
        OR (${raw(FriendRequestCol.fromUserId)} = ${userB} AND ${raw(FriendRequestCol.toUserId)} = ${userA})
      )
  `);
  return rows.map(mapFriendRequest);
}

export async function findLatestDeclinedRequestBetween(
  db: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT * FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${raw(FriendRequestCol.fromUserId)} = ${fromUserId}
      AND ${raw(FriendRequestCol.toUserId)} = ${toUserId}
      AND ${raw(FriendRequestCol.status)} = 'declined'
    ORDER BY ${raw(FriendRequestCol.respondedAt)} DESC NULLS LAST
    LIMIT 1
  `);
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
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

export async function insertFriendRequest(
  db: SqlClient,
  args: {
    readonly id: string;
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly message: string | null;
    readonly now: string;
  }
): Promise<FriendRequest> {
  await db.run(sql`
    INSERT INTO ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    (${raw(FriendRequestCol.id)}, ${raw(FriendRequestCol.fromUserId)}, ${raw(FriendRequestCol.toUserId)},
     ${raw(FriendRequestCol.status)}, ${raw(FriendRequestCol.message)},
     ${raw(FriendRequestCol.createdAt)}, ${raw(FriendRequestCol.updatedAt)})
    VALUES (${args.id}, ${args.fromUserId}, ${args.toUserId}, 'pending', ${args.message}, ${args.now}, ${args.now})
  `);
  const created = await findFriendRequestById(db, args.id);
  if (created === null) {
    throw new Error('friend request insert failed');
  }
  return created;
}

export async function markFriendRequestStatus(
  db: SqlClient,
  requestId: string,
  status: FriendRequestStatus,
  now: string
): Promise<void> {
  await db.run(sql`
    UPDATE ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    SET ${raw(FriendRequestCol.status)} = ${status},
        ${raw(FriendRequestCol.updatedAt)} = ${now},
        ${raw(FriendRequestCol.respondedAt)} = ${now}
    WHERE ${raw(FriendRequestCol.id)} = ${requestId}
  `);
}

export async function cancelPendingRequestsBetween(
  db: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  await db.run(sql`
    UPDATE ${raw(FRIEND_REQUESTS_TABLE.tableName)}
    SET ${raw(FriendRequestCol.status)} = 'cancelled',
        ${raw(FriendRequestCol.updatedAt)} = ${now},
        ${raw(FriendRequestCol.respondedAt)} = ${now}
    WHERE ${raw(FriendRequestCol.status)} = 'pending'
      AND (
        (${raw(FriendRequestCol.fromUserId)} = ${userA} AND ${raw(FriendRequestCol.toUserId)} = ${userB})
        OR (${raw(FriendRequestCol.fromUserId)} = ${userB} AND ${raw(FriendRequestCol.toUserId)} = ${userA})
      )
  `);
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

export async function upsertFriendProfileCache(
  db: SqlClient,
  args: {
    readonly ownerId: string;
    readonly friendId: string;
    readonly username: string;
    readonly avatarConfig: string | null;
    readonly now: string;
  }
): Promise<void> {
  await db.run(sql`
    INSERT INTO ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)}
    (${raw(FriendProfileCacheCol.id)}, ${raw(FriendProfileCacheCol.ownerId)}, ${raw(FriendProfileCacheCol.friendId)},
     ${raw(FriendProfileCacheCol.username)},
     ${raw(FriendProfileCacheCol.avatarConfig)}, ${raw(FriendProfileCacheCol.updatedAt)})
    VALUES (${pairId(args.ownerId, args.friendId)}, ${args.ownerId}, ${args.friendId}, ${args.username}, ${args.avatarConfig}, ${args.now})
    ON CONFLICT (${raw(FriendProfileCacheCol.ownerId)}, ${raw(FriendProfileCacheCol.friendId)}) DO UPDATE SET
      ${raw(FriendProfileCacheCol.username)} = excluded.${raw(FriendProfileCacheCol.username)},
      ${raw(FriendProfileCacheCol.avatarConfig)} = excluded.${raw(FriendProfileCacheCol.avatarConfig)},
      ${raw(FriendProfileCacheCol.updatedAt)} = excluded.${raw(FriendProfileCacheCol.updatedAt)}
  `);
}

export async function deleteFriendProfileCachePair(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)}
    WHERE (${raw(FriendProfileCacheCol.ownerId)} = ${userA} AND ${raw(FriendProfileCacheCol.friendId)} = ${userB})
       OR (${raw(FriendProfileCacheCol.ownerId)} = ${userB} AND ${raw(FriendProfileCacheCol.friendId)} = ${userA})
  `);
}

export async function listMutualFriendIds(
  db: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<readonly string[]> {
  const rows = await db.query<Record<string, unknown>>(sql`
    WITH my_friends AS (
      SELECT CASE
        WHEN ${raw(FriendshipCol.userLow)} = ${viewerId} THEN ${raw(FriendshipCol.userHigh)}
        ELSE ${raw(FriendshipCol.userLow)}
      END AS friend_id
      FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
      WHERE ${raw(FriendshipCol.userLow)} = ${viewerId} OR ${raw(FriendshipCol.userHigh)} = ${viewerId}
    ),
    their_friends AS (
      SELECT CASE
        WHEN ${raw(FriendshipCol.userLow)} = ${targetUserId} THEN ${raw(FriendshipCol.userHigh)}
        ELSE ${raw(FriendshipCol.userLow)}
      END AS friend_id
      FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
      WHERE ${raw(FriendshipCol.userLow)} = ${targetUserId} OR ${raw(FriendshipCol.userHigh)} = ${targetUserId}
    )
    SELECT mf.friend_id
    FROM my_friends mf
    INNER JOIN their_friends tf ON mf.friend_id = tf.friend_id
    LIMIT 50
  `);
  return rows
    .map((row) => readString(row, 'friend_id'))
    .filter((id) => id.length > 0);
}
