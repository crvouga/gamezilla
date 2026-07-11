import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { useMemo } from 'react';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { canonicalUserPair } from '../shared/canonical-pair';
import type { FriendshipStatus } from '../shared/friends-types';

type StatusRow = { readonly status: FriendshipStatus };

function friendshipStatusSql(
  myId: string,
  targetUserId: string
): { sql: string; params: string[] } {
  if (myId.length === 0 || targetUserId.length === 0 || myId === targetUserId) {
    return { sql: `SELECT 'none' AS status`, params: [] };
  }
  const { userLow, userHigh } = canonicalUserPair(myId, targetUserId);
  return {
    sql: `SELECT CASE
            WHEN EXISTS (
              SELECT 1 FROM ${USER_BLOCKS_TABLE.tableName}
              WHERE ${UserBlockCol.blockerId} = ? AND ${UserBlockCol.blockedId} = ?
            ) THEN 'blocked_by_me'
            WHEN EXISTS (
              SELECT 1 FROM ${FRIENDSHIPS_TABLE.tableName}
              WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?
            ) THEN 'friends'
            WHEN EXISTS (
              SELECT 1 FROM ${FRIEND_REQUESTS_TABLE.tableName}
              WHERE ${FriendRequestCol.fromUserId} = ?
                AND ${FriendRequestCol.toUserId} = ?
                AND ${FriendRequestCol.status} = 'pending'
            ) THEN 'pending_outgoing'
            WHEN EXISTS (
              SELECT 1 FROM ${FRIEND_REQUESTS_TABLE.tableName}
              WHERE ${FriendRequestCol.fromUserId} = ?
                AND ${FriendRequestCol.toUserId} = ?
                AND ${FriendRequestCol.status} = 'pending'
            ) THEN 'pending_incoming'
            ELSE 'none'
          END AS status`,
    params: [
      myId,
      targetUserId,
      userLow,
      userHigh,
      myId,
      targetUserId,
      targetUserId,
      myId,
    ],
  };
}

export function useFriendshipStatus(targetUserId: string): FriendshipStatus {
  const myId = useMyId();
  const query = useMemo(
    () => friendshipStatusSql(myId, targetUserId),
    [myId, targetUserId]
  );
  const enabled = myId.length > 0 && targetUserId.length > 0 && myId !== targetUserId;
  const { row } = useWatchOne<StatusRow>(query.sql, enabled ? query.params : ['']);
  if (!enabled) return 'none';
  return row?.status ?? 'none';
}
