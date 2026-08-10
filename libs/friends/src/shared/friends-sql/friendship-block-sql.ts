import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { canonicalUserPair } from '../canonical-pair';
import { pairId } from '../pair-id';

type Db = Pick<SqlClient, 'query' | 'run'>;

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export async function friendshipExists(
  db: Db,
  userA: string,
  userB: string
): Promise<boolean> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT id
    FROM friendships
    WHERE user_low = ${userLow}
      AND user_high = ${userHigh}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: Db,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT blocker_id, blocked_id
    FROM user_blocks
    WHERE deleted_at IS NULL
      AND (
        (blocker_id = ${userA} AND blocked_id = ${userB})
        OR (blocker_id = ${userB} AND blocked_id = ${userA})
      )
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, 'blocker_id');
  if (blockerId === userA) return 'by_a';
  return 'by_b';
}

export async function insertFriendship(
  db: Db,
  args: {
    readonly userA: string;
    readonly userB: string;
    readonly sourceRequestId: string;
    readonly now: string;
  }
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(args.userA, args.userB);
  await db.run(sql<void>`
    INSERT INTO friendships (id, user_low, user_high, created_at, source_request_id, deleted_at)
    VALUES (
      ${pairId(userLow, userHigh)},
      ${userLow},
      ${userHigh},
      ${args.now},
      ${args.sourceRequestId},
      ${null}
    )
    ON CONFLICT (user_low, user_high) DO UPDATE SET
      deleted_at = NULL,
      created_at = excluded.created_at,
      source_request_id = excluded.source_request_id
  `);
}

export async function softDeleteFriendship(
  db: Db,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(sql<void>`
    UPDATE friendships
    SET deleted_at = ${now}
    WHERE user_low = ${userLow}
      AND user_high = ${userHigh}
      AND deleted_at IS NULL
  `);
}

export async function insertBlock(
  db: Db,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at, deleted_at)
    VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now}, ${null})
    ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
      deleted_at = NULL,
      created_at = excluded.created_at
  `);
}

export async function softDeleteBlock(
  db: Db,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql<void>`
    UPDATE user_blocks
    SET deleted_at = ${now}
    WHERE blocker_id = ${blockerId}
      AND blocked_id = ${blockedId}
      AND deleted_at IS NULL
  `);
}
