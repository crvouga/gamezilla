import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { canonicalUserPair } from '../canonical-pair';
import { pairId } from '../pair-id';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export async function friendshipExists(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT id
    FROM friendships
    WHERE user_low = ${userLow} AND user_high = ${userHigh}
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT blocker_id, blocked_id
    FROM user_blocks
    WHERE (blocker_id = ${userA} AND blocked_id = ${userB})
       OR (blocker_id = ${userB} AND blocked_id = ${userA})
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, 'blocker_id');
  if (blockerId === userA) return 'by_a';
  return 'by_b';
}

export async function insertFriendship(
  db: SqlClient,
  args: {
    readonly userA: string;
    readonly userB: string;
    readonly sourceRequestId: string;
    readonly now: string;
  }
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(args.userA, args.userB);
  await db.run(sql`
    INSERT INTO friendships (id, user_low, user_high, created_at, source_request_id)
    VALUES (
      ${pairId(userLow, userHigh)},
      ${userLow},
      ${userHigh},
      ${args.now},
      ${args.sourceRequestId}
    )
    ON CONFLICT (user_low, user_high) DO NOTHING
  `);
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(sql`
    DELETE FROM friendships
    WHERE user_low = ${userLow} AND user_high = ${userHigh}
  `);
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(sql`
    INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at)
    VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now})
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `);
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM user_blocks
    WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
  `);
}
