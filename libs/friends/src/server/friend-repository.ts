import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import { canonicalUserPair } from '../shared/canonical-pair';
import type {
  FriendRequest,
  FriendRequestStatus,
} from '../shared/friends-types';
import { pairId } from '../shared/pair-id';

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
  const status = readString(row, 'status');
  return {
    id: readString(row, 'id'),
    fromUserId: readString(row, 'from_user_id'),
    toUserId: readString(row, 'to_user_id'),
    status: status as FriendRequestStatus,
    message: readNullableString(row, 'message'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
    respondedAt: readNullableString(row, 'responded_at'),
  };
}

export async function findFriendRequestById(
  db: SqlClient,
  requestId: string
): Promise<FriendRequest | null> {
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE id = ${requestId}
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
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'pending'
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
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE status = 'pending'
      AND (
        (from_user_id = ${userA} AND to_user_id = ${userB})
        OR (from_user_id = ${userB} AND to_user_id = ${userA})
      )
  `);
  return rows.map(mapFriendRequest);
}

export async function findLatestDeclinedRequestBetween(
  db: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'declined'
    ORDER BY responded_at DESC NULLS LAST
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
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id
    FROM friendships
    WHERE user_low = ${userLow}
      AND user_high = ${userHigh}
      AND _deleted_at IS NULL
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT blocker_id, blocked_id
    FROM user_blocks
    WHERE _deleted_at IS NULL
      AND (
        (blocker_id = ${userA} AND blocked_id = ${userB})
        OR (blocker_id = ${userB} AND blocked_id = ${userA})
      )
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, 'blocker_id');
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
  await db.run(sql<void>`
    INSERT INTO friend_requests (id, from_user_id, to_user_id, status, message, created_at, updated_at)
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
  await db.run(sql<void>`
    UPDATE friend_requests
    SET status = ${status}, updated_at = ${now}, responded_at = ${now}
    WHERE id = ${requestId}
  `);
}

export async function cancelPendingRequestsBetween(
  db: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  await db.run(sql<void>`
    UPDATE friend_requests
    SET status = 'cancelled', updated_at = ${now}, responded_at = ${now}
    WHERE status = 'pending'
      AND (
        (from_user_id = ${userA} AND to_user_id = ${userB})
        OR (from_user_id = ${userB} AND to_user_id = ${userA})
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
  await db.run(sql<void>`
    INSERT INTO friendships (
      id, user_low, user_high, created_at, source_request_id, _deleted_at
    )
    VALUES (
      ${pairId(userLow, userHigh)},
      ${userLow},
      ${userHigh},
      ${args.now},
      ${args.sourceRequestId},
      ${null}
    )
    ON CONFLICT (user_low, user_high) DO UPDATE SET
      _deleted_at = NULL,
      created_at = excluded.created_at,
      source_request_id = excluded.source_request_id
  `);
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string,
  now: string = new Date().toISOString()
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(sql<void>`
    UPDATE friendships
    SET _deleted_at = ${now}
    WHERE user_low = ${userLow}
      AND user_high = ${userHigh}
      AND _deleted_at IS NULL
  `);
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at, _deleted_at)
    VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now}, ${null})
    ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
      _deleted_at = NULL,
      created_at = excluded.created_at
  `);
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.run(sql<void>`
    UPDATE user_blocks
    SET _deleted_at = ${now}
    WHERE blocker_id = ${blockerId}
      AND blocked_id = ${blockedId}
      AND _deleted_at IS NULL
  `);
}

export async function listMutualFriendIds(
  db: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<readonly string[]> {
  const rows = await db.query(sql<Record<string, unknown>>`
    WITH my_friends AS (
      SELECT CASE WHEN user_low = ${viewerId} THEN user_high ELSE user_low END AS friend_id
      FROM friendships
      WHERE (user_low = ${viewerId} OR user_high = ${viewerId})
        AND _deleted_at IS NULL
    ),
    their_friends AS (
      SELECT CASE WHEN user_low = ${targetUserId} THEN user_high ELSE user_low END AS friend_id
      FROM friendships
      WHERE (user_low = ${targetUserId} OR user_high = ${targetUserId})
        AND _deleted_at IS NULL
    )
    SELECT mf.friend_id
    FROM my_friends AS mf
    INNER JOIN their_friends AS tf ON mf.friend_id = tf.friend_id
    LIMIT 50
  `);
  return rows
    .map((row) => readString(row, 'friend_id'))
    .filter((id) => id.length > 0);
}
