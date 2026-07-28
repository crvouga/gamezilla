import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import { sql, ident } from '@pkgs/sql';
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
    ORDER BY ${ident(FriendRequestCol.updatedAt)} DESC
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
