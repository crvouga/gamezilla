import { useMyId } from '@libs/auth/client/use-current-user';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

import { useQuery, useSyncEngine } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import { canonicalUserPair } from '../shared/canonical-pair';
import type { FriendshipStatus } from '../shared/friends-types';

type StatusRow = { readonly status: FriendshipStatus };

function noneStatusSql(): Sql<StatusRow> {
  return sql<StatusRow>`SELECT 'none' AS status`;
}

function friendshipStatusSql(
  myId: string,
  targetUserId: string
): Sql<StatusRow> {
  if (myId.length === 0 || targetUserId.length === 0 || myId === targetUserId) {
    return noneStatusSql();
  }
  const { userLow, userHigh } = canonicalUserPair(myId, targetUserId);
  return sql<StatusRow>`
    SELECT CASE
      WHEN EXISTS (
        SELECT blocker_id
        FROM friends_blocks
        WHERE blocker_id = ${myId}
          AND blocked_id = ${targetUserId}
          AND deleted_at IS NULL
      ) THEN 'blocked_by_me'
      WHEN EXISTS (
        SELECT user_low
        FROM friends_friendships
        WHERE user_low = ${userLow}
          AND user_high = ${userHigh}
          AND deleted_at IS NULL
      ) THEN 'friends'
      WHEN EXISTS (
        SELECT from_user_id
        FROM friends_requests
        WHERE from_user_id = ${myId}
          AND to_user_id = ${targetUserId}
          AND status = 'pending'
      ) THEN 'pending_outgoing'
      WHEN EXISTS (
        SELECT from_user_id
        FROM friends_requests
        WHERE from_user_id = ${targetUserId}
          AND to_user_id = ${myId}
          AND status = 'pending'
      ) THEN 'pending_incoming'
      ELSE 'none'
    END AS status
  `;
}

export function useFriendshipStatus(targetUserId: string): FriendshipStatus {
  const { paintReady } = useSyncEngine();
  const myId = useMyId();
  const enabled =
    paintReady &&
    myId.length > 0 &&
    targetUserId.length > 0 &&
    myId !== targetUserId;
  const query = useMemo(
    () => (enabled ? friendshipStatusSql(myId, targetUserId) : noneStatusSql()),
    [enabled, myId, targetUserId]
  );
  const { rows } = useQuery(query);
  const row = rows[0] ?? null;
  if (!paintReady || !enabled) return 'none';
  return row?.status ?? 'none';
}
