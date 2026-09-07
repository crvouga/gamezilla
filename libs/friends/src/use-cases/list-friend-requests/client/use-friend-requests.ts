import { useMyId } from '@libs/auth/public/use-current-user';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

import { createQuery, useSyncEngine } from '@pkgs/sync-engine/solid';
import { createMemo } from 'solid-js';

import type { FriendRequest } from '../../../shared/friendship/friends-types';

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
    FROM friends_requests
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
    FROM friends_requests
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
  readonly requests: readonly FriendRequest[];
  readonly isLoading: boolean;
} {
  const { paintReady } = useSyncEngine();
  const myId = useMyId();
  const enabled = createMemo(() => paintReady() && myId().length > 0);
  const { rows, isLoading } = createQuery(() =>
    pendingIncomingSql(myId(), enabled())
  );
  const requests = createMemo(() => rows().map(mapRequestRow));
  return {
    get requests() {
      return paintReady() ? requests() : [];
    },
    get isLoading() {
      if (!paintReady()) return true;
      return myId().length === 0 ? false : isLoading();
    },
  };
}

export function useOutgoingFriendRequests(): {
  readonly requests: readonly FriendRequest[];
  readonly isLoading: boolean;
} {
  const { paintReady } = useSyncEngine();
  const myId = useMyId();
  const enabled = createMemo(() => paintReady() && myId().length > 0);
  const { rows, isLoading } = createQuery(() =>
    pendingOutgoingSql(myId(), enabled())
  );
  const requests = createMemo(() => rows().map(mapRequestRow));
  return {
    get requests() {
      return paintReady() ? requests() : [];
    },
    get isLoading() {
      if (!paintReady()) return true;
      return myId().length === 0 ? false : isLoading();
    },
  };
}

export function useFriendRequests(): {
  readonly incoming: readonly FriendRequest[];
  readonly outgoing: readonly FriendRequest[];
  readonly isLoading: boolean;
} {
  const incomingState = useIncomingFriendRequests();
  const outgoingState = useOutgoingFriendRequests();
  return {
    get incoming() {
      return incomingState.requests;
    },
    get outgoing() {
      return outgoingState.requests;
    },
    get isLoading() {
      return incomingState.isLoading || outgoingState.isLoading;
    },
  };
}
