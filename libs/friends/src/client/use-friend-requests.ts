import { useMyId } from '@libs/auth/client/use-current-user';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useMemo } from 'react';

import type { FriendRequest } from '../shared/friends-types';

type FriendRequestRow = {
  readonly id: string;
  readonly from_user_id: string;
  readonly to_user_id: string;
  readonly status: string;
  readonly message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly responded_at: string | null;
};

function emptyRequestsSql(): Sql<FriendRequestRow> {
  return sql<FriendRequestRow>`
    SELECT
      CAST(NULL AS TEXT) AS id,
      CAST(NULL AS TEXT) AS from_user_id,
      CAST(NULL AS TEXT) AS to_user_id,
      CAST(NULL AS TEXT) AS status,
      CAST(NULL AS TEXT) AS message,
      CAST(NULL AS TEXT) AS created_at,
      CAST(NULL AS TEXT) AS updated_at,
      CAST(NULL AS TEXT) AS responded_at
    WHERE false
  `;
}

function pendingIncomingSql(
  myId: string,
  enabled: boolean
): Sql<FriendRequestRow> {
  if (!enabled) return emptyRequestsSql();
  return sql<FriendRequestRow>`
    SELECT 
      id, 
      from_user_id, 
      to_user_id, 
      status, 
      message, 
      created_at, 
      updated_at, 
      responded_at
    FROM friend_requests
    WHERE to_user_id = ${myId} AND status = 'pending'
    ORDER BY created_at DESC
  `;
}

function pendingOutgoingSql(
  myId: string,
  enabled: boolean
): Sql<FriendRequestRow> {
  if (!enabled) return emptyRequestsSql();
  return sql<FriendRequestRow>`
    SELECT 
      id, 
      from_user_id, 
      to_user_id, 
      status, 
      message, 
      created_at, 
      updated_at, 
      responded_at
    FROM friend_requests
    WHERE from_user_id = ${myId} AND status = 'pending'
    ORDER BY created_at DESC
  `;
}

function mapRequestRow(row: FriendRequestRow): FriendRequest {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status as FriendRequest['status'],
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
  };
}

export function useIncomingFriendRequests(): {
  requests: readonly FriendRequest[];
  isLoading: boolean;
} {
  const paintReady = useSyncEnginePaintReady();
  const myId = useMyId();
  const enabled = paintReady && myId.length > 0;
  const query = useMemo(
    () => pendingIncomingSql(myId, enabled),
    [myId, enabled]
  );
  const { rows, isLoading } = useQuery(query);
  const requests = useMemo(() => rows.map(mapRequestRow), [rows]);
  if (!paintReady) {
    return { requests: [], isLoading: true };
  }
  return { requests, isLoading: myId.length === 0 ? false : isLoading };
}

export function useOutgoingFriendRequests(): {
  requests: readonly FriendRequest[];
  isLoading: boolean;
} {
  const paintReady = useSyncEnginePaintReady();
  const myId = useMyId();
  const enabled = paintReady && myId.length > 0;
  const query = useMemo(
    () => pendingOutgoingSql(myId, enabled),
    [myId, enabled]
  );
  const { rows, isLoading } = useQuery(query);
  const requests = useMemo(() => rows.map(mapRequestRow), [rows]);
  if (!paintReady) {
    return { requests: [], isLoading: true };
  }
  return { requests, isLoading: myId.length === 0 ? false : isLoading };
}

export function useFriendRequests(): {
  incoming: readonly FriendRequest[];
  outgoing: readonly FriendRequest[];
  isLoading: boolean;
} {
  const incomingState = useIncomingFriendRequests();
  const outgoingState = useOutgoingFriendRequests();
  return {
    incoming: incomingState.requests,
    outgoing: outgoingState.requests,
    isLoading: incomingState.isLoading || outgoingState.isLoading,
  };
}
