import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { FriendRequest } from '../shared/friends-types';

type FriendRequestRow = Record<string, unknown>;

function readString(row: FriendRequestRow, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function readNullableString(row: FriendRequestRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function mapFriendRequest(row: FriendRequestRow): FriendRequest {
  const status = readString(row, FriendRequestCol.status);
  return {
    id: readString(row, FriendRequestCol.id),
    fromUserId: readString(row, FriendRequestCol.fromUserId),
    toUserId: readString(row, FriendRequestCol.toUserId),
    status: status as FriendRequest['status'],
    message: readNullableString(row, FriendRequestCol.message),
    createdAt: readString(row, FriendRequestCol.createdAt),
    updatedAt: readString(row, FriendRequestCol.updatedAt),
    respondedAt: readNullableString(row, FriendRequestCol.respondedAt),
  };
}

export async function listPendingIncomingRequests(
  sql: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await sql.query<FriendRequestRow>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.toUserId} = ?
       AND ${FriendRequestCol.status} = 'pending'
     ORDER BY ${FriendRequestCol.createdAt} DESC`,
    [userId]
  );
  return rows.map(mapFriendRequest);
}

export async function listPendingOutgoingRequests(
  sql: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await sql.query<FriendRequestRow>(
    `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName}
     WHERE ${FriendRequestCol.fromUserId} = ?
       AND ${FriendRequestCol.status} = 'pending'
     ORDER BY ${FriendRequestCol.createdAt} DESC`,
    [userId]
  );
  return rows.map(mapFriendRequest);
}
