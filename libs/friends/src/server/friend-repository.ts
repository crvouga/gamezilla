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
import { sql, ident } from '@pkgs/sql';
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
    SELECT * FROM ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${ident(FriendRequestCol.id)} = ${requestId}
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
    SELECT * FROM ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${ident(FriendRequestCol.fromUserId)} = ${fromUserId}
      AND ${ident(FriendRequestCol.toUserId)} = ${toUserId}
      AND ${ident(FriendRequestCol.status)} = 'pending'
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
    SELECT * FROM ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${ident(FriendRequestCol.status)} = 'pending'
      AND (
        (${ident(FriendRequestCol.fromUserId)} = ${userA} AND ${ident(FriendRequestCol.toUserId)} = ${userB})
        OR (${ident(FriendRequestCol.fromUserId)} = ${userB} AND ${ident(FriendRequestCol.toUserId)} = ${userA})
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
    SELECT * FROM ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    WHERE ${ident(FriendRequestCol.fromUserId)} = ${fromUserId}
      AND ${ident(FriendRequestCol.toUserId)} = ${toUserId}
      AND ${ident(FriendRequestCol.status)} = 'declined'
    ORDER BY ${ident(FriendRequestCol.respondedAt)} DESC NULLS LAST
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
    INSERT INTO ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    (${ident(FriendRequestCol.id)}, ${ident(FriendRequestCol.fromUserId)}, ${ident(FriendRequestCol.toUserId)},
     ${ident(FriendRequestCol.status)}, ${ident(FriendRequestCol.message)},
     ${ident(FriendRequestCol.createdAt)}, ${ident(FriendRequestCol.updatedAt)})
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
    UPDATE ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    SET ${ident(FriendRequestCol.status)} = ${status},
        ${ident(FriendRequestCol.updatedAt)} = ${now},
        ${ident(FriendRequestCol.respondedAt)} = ${now}
    WHERE ${ident(FriendRequestCol.id)} = ${requestId}
  `);
}

export async function cancelPendingRequestsBetween(
  db: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  await db.run(sql`
    UPDATE ${ident(FRIEND_REQUESTS_TABLE.tableName)}
    SET ${ident(FriendRequestCol.status)} = 'cancelled',
        ${ident(FriendRequestCol.updatedAt)} = ${now},
        ${ident(FriendRequestCol.respondedAt)} = ${now}
    WHERE ${ident(FriendRequestCol.status)} = 'pending'
      AND (
        (${ident(FriendRequestCol.fromUserId)} = ${userA} AND ${ident(FriendRequestCol.toUserId)} = ${userB})
        OR (${ident(FriendRequestCol.fromUserId)} = ${userB} AND ${ident(FriendRequestCol.toUserId)} = ${userA})
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
    INSERT INTO ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)}
    (${ident(FriendProfileCacheCol.id)}, ${ident(FriendProfileCacheCol.ownerId)}, ${ident(FriendProfileCacheCol.friendId)},
     ${ident(FriendProfileCacheCol.username)},
     ${ident(FriendProfileCacheCol.avatarConfig)}, ${ident(FriendProfileCacheCol.updatedAt)})
    VALUES (${pairId(args.ownerId, args.friendId)}, ${args.ownerId}, ${args.friendId}, ${args.username}, ${args.avatarConfig}, ${args.now})
    ON CONFLICT (${ident(FriendProfileCacheCol.ownerId)}, ${ident(FriendProfileCacheCol.friendId)}) DO UPDATE SET
      ${ident(FriendProfileCacheCol.username)} = excluded.${ident(FriendProfileCacheCol.username)},
      ${ident(FriendProfileCacheCol.avatarConfig)} = excluded.${ident(FriendProfileCacheCol.avatarConfig)},
      ${ident(FriendProfileCacheCol.updatedAt)} = excluded.${ident(FriendProfileCacheCol.updatedAt)}
  `);
}

export async function deleteFriendProfileCachePair(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)}
    WHERE (${ident(FriendProfileCacheCol.ownerId)} = ${userA} AND ${ident(FriendProfileCacheCol.friendId)} = ${userB})
       OR (${ident(FriendProfileCacheCol.ownerId)} = ${userB} AND ${ident(FriendProfileCacheCol.friendId)} = ${userA})
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
        WHEN ${ident(FriendshipCol.userLow)} = ${viewerId} THEN ${ident(FriendshipCol.userHigh)}
        ELSE ${ident(FriendshipCol.userLow)}
      END AS friend_id
      FROM ${ident(FRIENDSHIPS_TABLE.tableName)}
      WHERE ${ident(FriendshipCol.userLow)} = ${viewerId} OR ${ident(FriendshipCol.userHigh)} = ${viewerId}
    ),
    their_friends AS (
      SELECT CASE
        WHEN ${ident(FriendshipCol.userLow)} = ${targetUserId} THEN ${ident(FriendshipCol.userHigh)}
        ELSE ${ident(FriendshipCol.userLow)}
      END AS friend_id
      FROM ${ident(FRIENDSHIPS_TABLE.tableName)}
      WHERE ${ident(FriendshipCol.userLow)} = ${targetUserId} OR ${ident(FriendshipCol.userHigh)} = ${targetUserId}
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
