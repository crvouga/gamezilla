import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql, type Sql } from '@pkgs/sql';
import { useMemo } from 'react';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { canonicalUserPair } from '../shared/canonical-pair';
import type { FriendshipStatus } from '../shared/friends-types';

type StatusRow = { readonly status: FriendshipStatus };

function friendshipStatusSql(myId: string, targetUserId: string): Sql {
  if (myId.length === 0 || targetUserId.length === 0 || myId === targetUserId) {
    return sql`SELECT 'none' AS status`;
  }
  const { userLow, userHigh } = canonicalUserPair(myId, targetUserId);
  return sql`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM ${raw(USER_BLOCKS_TABLE.tableName)}
        WHERE ${raw(UserBlockCol.blockerId)} = ${myId} AND ${raw(UserBlockCol.blockedId)} = ${targetUserId}
      ) THEN 'blocked_by_me'
      WHEN EXISTS (
        SELECT 1 FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
        WHERE ${raw(FriendshipCol.userLow)} = ${userLow} AND ${raw(FriendshipCol.userHigh)} = ${userHigh}
      ) THEN 'friends'
      WHEN EXISTS (
        SELECT 1 FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
        WHERE ${raw(FriendRequestCol.fromUserId)} = ${myId}
          AND ${raw(FriendRequestCol.toUserId)} = ${targetUserId}
          AND ${raw(FriendRequestCol.status)} = 'pending'
      ) THEN 'pending_outgoing'
      WHEN EXISTS (
        SELECT 1 FROM ${raw(FRIEND_REQUESTS_TABLE.tableName)}
        WHERE ${raw(FriendRequestCol.fromUserId)} = ${targetUserId}
          AND ${raw(FriendRequestCol.toUserId)} = ${myId}
          AND ${raw(FriendRequestCol.status)} = 'pending'
      ) THEN 'pending_incoming'
      ELSE 'none'
    END AS status
  `;
}

export function useFriendshipStatus(targetUserId: string): FriendshipStatus {
  const myId = useMyId();
  const enabled =
    myId.length > 0 && targetUserId.length > 0 && myId !== targetUserId;
  const query = useMemo(
    () =>
      enabled
        ? friendshipStatusSql(myId, targetUserId)
        : sql`SELECT 'none' AS status`,
    [enabled, myId, targetUserId]
  );
  const { row } = useWatchOne<StatusRow>(query);
  if (!enabled) return 'none';
  return row?.status ?? 'none';
}
