import { useMyId } from '@libs/auth-client/use-current-user';
import { canonicalUserPair } from '@libs/friends-shared/canonical-pair';
import type { FriendshipStatus } from '@libs/friends-shared/friends-types';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

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

export function useFriendshipStatus(
  targetUserId: Accessor<string>
): Accessor<FriendshipStatus> {
  const { paintReady } = useSyncEngine();
  const myId = useMyId();
  const enabled = createMemo(() => {
    const target = targetUserId();
    return (
      paintReady() &&
      myId().length > 0 &&
      target.length > 0 &&
      myId() !== target
    );
  });
  const query = createQuery(() =>
    enabled() ? friendshipStatusSql(myId(), targetUserId()) : noneStatusSql()
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => {
    if (!paintReady() || !enabled()) return 'none';
    return row()?.status ?? 'none';
  });
}
