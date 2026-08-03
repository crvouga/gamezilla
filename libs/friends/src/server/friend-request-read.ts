import { sql } from '@pkgs/sql';

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
  const status = readString(row, 'status');
  return {
    id: readString(row, 'id'),
    fromUserId: readString(row, 'from_user_id'),
    toUserId: readString(row, 'to_user_id'),
    status: status as FriendRequest['status'],
    message: readNullableString(row, 'message'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
    respondedAt: readNullableString(row, 'responded_at'),
  };
}

export async function listPendingIncomingRequests(
  db: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query(sql<FriendRequestRow>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE to_user_id = ${userId} AND status = 'pending'
    ORDER BY created_at DESC
  `);
  return rows.map(mapFriendRequest);
}

export async function listPendingOutgoingRequests(
  db: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query(sql<FriendRequestRow>`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests
    WHERE from_user_id = ${userId} AND status = 'pending'
    ORDER BY created_at DESC
  `);
  return rows.map(mapFriendRequest);
}
