import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import sql, { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { FriendRequest, FriendRequestStatus } from '../friends-types';

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

export function mapFriendRequest(row: Record<string, unknown>): FriendRequest {
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
    sqlMap({
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
    sql`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId} 
      AND to_user_id = ${toUserId} 
      AND status = 'pending'
    LIMIT 1
    `
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
    sqlMap({
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
    sqlMap({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.fromUserId, fromUserId],
        ['=', FriendRequestCol.toUserId, toUserId],
        ['=', FriendRequestCol.status, 'declined'],
      ],
      orderBy: [[FriendRequestCol.updatedAt, 'desc']],
      limit: 1,
    })
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
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
    sql`
    INSERT INTO friend_requests (id, from_user_id, to_user_id, status, message, created_at, updated_at)
    VALUES (${args.id}, ${args.fromUserId}, ${args.toUserId}, 'pending', ${args.message}, ${args.now}, ${args.now})
    `
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
    sqlMap({
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
    sqlMap({
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
