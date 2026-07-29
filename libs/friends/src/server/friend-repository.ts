import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { honey, col, type Query } from '@pkgs/sql';
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
  const rows = await db.query<Record<string, unknown>>(
    honey({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: ['=', FriendRequestCol.id, requestId],
      limit: 1,
    })
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestBetween(
  db: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.fromUserId, fromUserId],
        ['=', FriendRequestCol.toUserId, toUserId],
        ['=', FriendRequestCol.status, 'pending'],
      ],
      limit: 1,
    })
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function findPendingRequestsBetweenPair(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.status, 'pending'],
        [
          'or',
          [
            'and',
            ['=', FriendRequestCol.fromUserId, userA],
            ['=', FriendRequestCol.toUserId, userB],
          ],
          [
            'and',
            ['=', FriendRequestCol.fromUserId, userB],
            ['=', FriendRequestCol.toUserId, userA],
          ],
        ],
      ],
    })
  );
  return rows.map(mapFriendRequest);
}

export async function findLatestDeclinedRequestBetween(
  db: SqlClient,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequest | null> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.fromUserId, fromUserId],
        ['=', FriendRequestCol.toUserId, toUserId],
        ['=', FriendRequestCol.status, 'declined'],
      ],
      orderBy: [[FriendRequestCol.respondedAt, 'desc', { nulls: 'last' }]],
      limit: 1,
    })
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
}

export async function friendshipExists(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [FriendshipCol.id],
      from: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
      limit: 1,
    })
  );
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [UserBlockCol.blockerId, UserBlockCol.blockedId],
      from: USER_BLOCKS_TABLE.tableName,
      where: [
        'or',
        [
          'and',
          ['=', UserBlockCol.blockerId, userA],
          ['=', UserBlockCol.blockedId, userB],
        ],
        [
          'and',
          ['=', UserBlockCol.blockerId, userB],
          ['=', UserBlockCol.blockedId, userA],
        ],
      ],
      limit: 1,
    })
  );
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
  await db.run(
    honey({
      insertInto: FRIEND_REQUESTS_TABLE.tableName,
      values: {
        [FriendRequestCol.id]: args.id,
        [FriendRequestCol.fromUserId]: args.fromUserId,
        [FriendRequestCol.toUserId]: args.toUserId,
        [FriendRequestCol.status]: 'pending',
        [FriendRequestCol.message]: args.message,
        [FriendRequestCol.createdAt]: args.now,
        [FriendRequestCol.updatedAt]: args.now,
      },
    })
  );
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
  await db.run(
    honey({
      update: FRIEND_REQUESTS_TABLE.tableName,
      set: {
        [FriendRequestCol.status]: status,
        [FriendRequestCol.updatedAt]: now,
        [FriendRequestCol.respondedAt]: now,
      },
      where: ['=', FriendRequestCol.id, requestId],
    })
  );
}

export async function cancelPendingRequestsBetween(
  db: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  await db.run(
    honey({
      update: FRIEND_REQUESTS_TABLE.tableName,
      set: {
        [FriendRequestCol.status]: 'cancelled',
        [FriendRequestCol.updatedAt]: now,
        [FriendRequestCol.respondedAt]: now,
      },
      where: [
        'and',
        ['=', FriendRequestCol.status, 'pending'],
        [
          'or',
          [
            'and',
            ['=', FriendRequestCol.fromUserId, userA],
            ['=', FriendRequestCol.toUserId, userB],
          ],
          [
            'and',
            ['=', FriendRequestCol.fromUserId, userB],
            ['=', FriendRequestCol.toUserId, userA],
          ],
        ],
      ],
    })
  );
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
  await db.run(
    honey({
      insertInto: FRIENDSHIPS_TABLE.tableName,
      values: {
        [FriendshipCol.id]: pairId(userLow, userHigh),
        [FriendshipCol.userLow]: userLow,
        [FriendshipCol.userHigh]: userHigh,
        [FriendshipCol.createdAt]: args.now,
        [FriendshipCol.sourceRequestId]: args.sourceRequestId,
      },
      onConflict: {
        target: [FriendshipCol.userLow, FriendshipCol.userHigh],
        doNothing: true,
      },
    })
  );
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(
    honey({
      deleteFrom: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
    })
  );
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(
    honey({
      insertInto: USER_BLOCKS_TABLE.tableName,
      values: {
        [UserBlockCol.id]: pairId(blockerId, blockedId),
        [UserBlockCol.blockerId]: blockerId,
        [UserBlockCol.blockedId]: blockedId,
        [UserBlockCol.createdAt]: now,
      },
      onConflict: {
        target: [UserBlockCol.blockerId, UserBlockCol.blockedId],
        doNothing: true,
      },
    })
  );
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await db.run(
    honey({
      deleteFrom: USER_BLOCKS_TABLE.tableName,
      where: [
        'and',
        ['=', UserBlockCol.blockerId, blockerId],
        ['=', UserBlockCol.blockedId, blockedId],
      ],
    })
  );
}

export async function listMutualFriendIds(
  db: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<readonly string[]> {
  const friendIdForViewer = (userId: string): Query => ({
    select: [
      [
        [
          'case',
          [[['=', FriendshipCol.userLow, userId], col(FriendshipCol.userHigh)]],
          col(FriendshipCol.userLow),
        ],
        'friend_id',
      ],
    ],
    from: FRIENDSHIPS_TABLE.tableName,
    where: [
      'or',
      ['=', FriendshipCol.userLow, userId],
      ['=', FriendshipCol.userHigh, userId],
    ],
  });
  const rows = await db.query<Record<string, unknown>>(
    honey({
      with: [
        ['my_friends', friendIdForViewer(viewerId)],
        ['their_friends', friendIdForViewer(targetUserId)],
      ],
      select: ['mf.friend_id'],
      from: ['my_friends', 'mf'],
      join: [
        ['their_friends', 'tf'],
        ['=', 'mf.friend_id', col('tf.friend_id')],
      ],
      limit: 50,
    })
  );
  return rows
    .map((row) => readString(row, 'friend_id'))
    .filter((id) => id.length > 0);
}
