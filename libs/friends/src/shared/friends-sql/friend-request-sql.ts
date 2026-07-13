import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  FriendRequest,
  FriendRequestStatus,
} from '../friends-types';

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
     ORDER BY ${FriendRequestCol.updatedAt} DESC
     LIMIT 1`,
    [fromUserId, toUserId]
  );
  const row = rows[0];
  return row === undefined ? null : mapFriendRequest(row);
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
