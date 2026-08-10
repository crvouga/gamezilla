import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

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

export class FriendRequestRepository {
  constructor(private readonly tx: SqlTx) {}

  async findById(requestId: string): Promise<FriendRequest | null> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
      FROM friend_requests
      WHERE id = ${requestId}
      LIMIT 1
    `);
    const row = rows[0];
    return row === undefined ? null : mapFriendRequest(row);
  }

  async findPendingBetween(
    fromUserId: string,
    toUserId: string
  ): Promise<FriendRequest | null> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
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

  async findPendingBetweenPair(
    userA: string,
    userB: string
  ): Promise<readonly FriendRequest[]> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
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

  async findLatestDeclinedBetween(
    fromUserId: string,
    toUserId: string
  ): Promise<FriendRequest | null> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
      FROM friend_requests
      WHERE from_user_id = ${fromUserId}
        AND to_user_id = ${toUserId}
        AND status = 'declined'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = rows[0];
    return row === undefined ? null : mapFriendRequest(row);
  }

  async listPendingIncoming(userId: string): Promise<readonly FriendRequest[]> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
      FROM friend_requests
      WHERE to_user_id = ${userId} AND status = 'pending'
      ORDER BY created_at DESC
    `);
    return rows.map(mapFriendRequest);
  }

  async listPendingOutgoing(userId: string): Promise<readonly FriendRequest[]> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
      FROM friend_requests
      WHERE from_user_id = ${userId} AND status = 'pending'
      ORDER BY created_at DESC
    `);
    return rows.map(mapFriendRequest);
  }

  async insert(args: {
    readonly id: string;
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly message: string | null;
    readonly now: string;
  }): Promise<FriendRequest> {
    await this.tx.run(sql<void>`
      INSERT INTO friend_requests (id, from_user_id, to_user_id, status, message, created_at, updated_at)
      VALUES (${args.id}, ${args.fromUserId}, ${args.toUserId}, 'pending', ${args.message}, ${args.now}, ${args.now})
    `);
    const created = await this.findById(args.id);
    if (created === null) {
      throw new Error('friend request insert failed');
    }
    return created;
  }

  async markStatus(
    requestId: string,
    status: FriendRequestStatus,
    now: string
  ): Promise<void> {
    await this.tx.run(sql<void>`
      UPDATE friend_requests
      SET status = ${status}, updated_at = ${now}, responded_at = ${now}
      WHERE id = ${requestId}
    `);
  }

  async cancelPendingBetween(
    userA: string,
    userB: string,
    now: string
  ): Promise<void> {
    await this.tx.run(sql<void>`
      UPDATE friend_requests
      SET status = 'cancelled', updated_at = ${now}, responded_at = ${now}
      WHERE status = 'pending'
        AND (
          (from_user_id = ${userA} AND to_user_id = ${userB})
          OR (from_user_id = ${userB} AND to_user_id = ${userA})
        )
    `);
  }
}
