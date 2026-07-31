import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import { sqlMap } from '@pkgs/sql';
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
  db: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query<FriendRequestRow>(
    sqlMap({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.toUserId, userId],
        ['=', FriendRequestCol.status, 'pending'],
      ],
      orderBy: [[FriendRequestCol.createdAt, 'desc']],
    })
  );
  return rows.map(mapFriendRequest);
}

export async function listPendingOutgoingRequests(
  db: SqlClient,
  userId: string
): Promise<readonly FriendRequest[]> {
  const rows = await db.query<FriendRequestRow>(
    sqlMap({
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.fromUserId, userId],
        ['=', FriendRequestCol.status, 'pending'],
      ],
      orderBy: [[FriendRequestCol.createdAt, 'desc']],
    })
  );
  return rows.map(mapFriendRequest);
}
