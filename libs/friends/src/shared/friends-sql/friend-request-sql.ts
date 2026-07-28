import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql } from '@pkgs/sql';
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
    ORDER BY ${raw(FriendRequestCol.updatedAt)} DESC
    LIMIT 1
  `);
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
