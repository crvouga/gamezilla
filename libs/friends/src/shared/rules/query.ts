import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export const FRIEND_REQUESTS_TABLE = 'friend_requests';
export const FRIENDSHIPS_TABLE = 'friendships';
export const USER_BLOCKS_TABLE = 'user_blocks';

export function readStringValue(
  values: Readonly<Record<string, unknown>> | undefined,
  key: string
): string | undefined {
  const raw = values?.[key];
  return typeof raw === 'string' ? raw : undefined;
}

export async function isBlockedEitherDirection(
  db: Pick<SqlClient, 'query'>,
  userA: string,
  userB: string
): Promise<boolean> {
  const rows = await db.query(sql<{ readonly blocker_id: string }>`
    SELECT blocker_id FROM user_blocks
    WHERE (blocker_id = ${userA} AND blocked_id = ${userB})
       OR (blocker_id = ${userB} AND blocked_id = ${userA})
    LIMIT 1
  `);
  return rows[0] !== undefined;
}

export async function friendshipExists(
  db: Pick<SqlClient, 'query'>,
  userA: string,
  userB: string
): Promise<boolean> {
  const userLow = userA < userB ? userA : userB;
  const userHigh = userA < userB ? userB : userA;
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM friendships
    WHERE user_low = ${userLow} AND user_high = ${userHigh}
    LIMIT 1
  `);
  return rows[0] !== undefined;
}

export type RequestRow = {
  readonly id: string;
  readonly from_user_id: string;
  readonly to_user_id: string;
  readonly status: string;
  readonly responded_at: string | null;
};

export async function findRequestById(
  db: Pick<SqlClient, 'query'>,
  requestId: string
): Promise<RequestRow | null> {
  const rows = await db.query(sql<RequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friend_requests
    WHERE id = ${requestId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function findPendingBetween(
  db: Pick<SqlClient, 'query'>,
  fromUserId: string,
  toUserId: string
): Promise<RequestRow | null> {
  const rows = await db.query(sql<RequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'pending'
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function findLatestDeclinedBetween(
  db: Pick<SqlClient, 'query'>,
  fromUserId: string,
  toUserId: string
): Promise<RequestRow | null> {
  const rows = await db.query(sql<RequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'declined'
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}
