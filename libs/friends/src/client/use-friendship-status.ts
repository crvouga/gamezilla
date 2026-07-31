import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { sqlMap, type Expr, type Sql } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { canonicalUserPair } from '../shared/canonical-pair';
import type { FriendshipStatus } from '../shared/friends-types';

type StatusRow = { readonly status: FriendshipStatus };

function noneStatusSql(): Sql {
  return sqlMap({
    select: [[['param', 'none'], 'status']],
  });
}

function existsBlock(myId: string, targetUserId: string): Expr {
  return [
    'exists',
    {
      select: [UserBlockCol.blockerId],
      from: USER_BLOCKS_TABLE.tableName,
      where: [
        'and',
        ['=', UserBlockCol.blockerId, myId],
        ['=', UserBlockCol.blockedId, targetUserId],
      ],
    },
  ];
}

function existsFriendship(userLow: string, userHigh: string): Expr {
  return [
    'exists',
    {
      select: [FriendshipCol.userLow],
      from: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
    },
  ];
}

function existsPendingRequest(fromUserId: string, toUserId: string): Expr {
  return [
    'exists',
    {
      select: [FriendRequestCol.fromUserId],
      from: FRIEND_REQUESTS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendRequestCol.fromUserId, fromUserId],
        ['=', FriendRequestCol.toUserId, toUserId],
        ['=', FriendRequestCol.status, 'pending'],
      ],
    },
  ];
}

function friendshipStatusSql(myId: string, targetUserId: string): Sql {
  if (myId.length === 0 || targetUserId.length === 0 || myId === targetUserId) {
    return noneStatusSql();
  }
  const { userLow, userHigh } = canonicalUserPair(myId, targetUserId);
  return sqlMap({
    select: [
      [
        [
          'case',
          [
            [existsBlock(myId, targetUserId), ['param', 'blocked_by_me']],
            [existsFriendship(userLow, userHigh), ['param', 'friends']],
            [
              existsPendingRequest(myId, targetUserId),
              ['param', 'pending_outgoing'],
            ],
            [
              existsPendingRequest(targetUserId, myId),
              ['param', 'pending_incoming'],
            ],
          ],
          ['param', 'none'],
        ],
        'status',
      ],
    ],
  });
}

export function useFriendshipStatus(targetUserId: string): FriendshipStatus {
  const myId = useMyId();
  const enabled =
    myId.length > 0 && targetUserId.length > 0 && myId !== targetUserId;
  const query = useMemo(
    () => (enabled ? friendshipStatusSql(myId, targetUserId) : noneStatusSql()),
    [enabled, myId, targetUserId]
  );
  const { row } = useWatchOne<StatusRow>(query);
  if (!enabled) return 'none';
  return row?.status ?? 'none';
}
