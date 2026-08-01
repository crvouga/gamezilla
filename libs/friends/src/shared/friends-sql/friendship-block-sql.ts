import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { sqlMap } from '@pkgs/sql-map';

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
  const rows = await db.query<Record<string, unknown>>(
    sqlMap({
      select: [FriendshipCol.id],
      from: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
      limit: 1,
    })
  );
  return rows.length > 0;
}

export async function isBlockedEitherDirection(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<'none' | 'by_a' | 'by_b'> {
  const rows = await db.query<Record<string, unknown>>(
    sqlMap({
      select: [UserBlockCol.blockerId, UserBlockCol.blockedId],
      from: USER_BLOCKS_TABLE.tableName,
      where: [
        'or',
        [
          'and',
          ['=', UserBlockCol.blockerId, userA],
          ['=', UserBlockCol.blockedId, userB],
        ],
        [
          'and',
          ['=', UserBlockCol.blockerId, userB],
          ['=', UserBlockCol.blockedId, userA],
        ],
      ],
      limit: 1,
    })
  );
  const row = rows[0];
  if (row === undefined) return 'none';
  const blockerId = readString(row, UserBlockCol.blockerId);
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
  await db.run(
    sqlMap({
      insertInto: FRIENDSHIPS_TABLE.tableName,
      values: {
        [FriendshipCol.id]: pairId(userLow, userHigh),
        [FriendshipCol.userLow]: userLow,
        [FriendshipCol.userHigh]: userHigh,
        [FriendshipCol.createdAt]: args.now,
        [FriendshipCol.sourceRequestId]: args.sourceRequestId,
      },
      onConflict: {
        target: [FriendshipCol.userLow, FriendshipCol.userHigh],
        doNothing: true,
      },
    })
  );
}

export async function deleteFriendship(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const { userLow, userHigh } = canonicalUserPair(userA, userB);
  await db.run(
    sqlMap({
      deleteFrom: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
    })
  );
}

export async function insertBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  await db.run(
    sqlMap({
      insertInto: USER_BLOCKS_TABLE.tableName,
      values: {
        [UserBlockCol.id]: pairId(blockerId, blockedId),
        [UserBlockCol.blockerId]: blockerId,
        [UserBlockCol.blockedId]: blockedId,
        [UserBlockCol.createdAt]: now,
      },
      onConflict: {
        target: [UserBlockCol.blockerId, UserBlockCol.blockedId],
        doNothing: true,
      },
    })
  );
}

export async function deleteBlock(
  db: SqlClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  await db.run(
    sqlMap({
      deleteFrom: USER_BLOCKS_TABLE.tableName,
      where: [
        'and',
        ['=', UserBlockCol.blockerId, blockerId],
        ['=', UserBlockCol.blockedId, blockedId],
      ],
    })
  );
}
