import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_REQUESTS_TABLE,
  FriendRequestCol,
} from '@libs/db/shared/friends-tables';
import { useMemo } from 'react';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

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

function pendingIncomingSql(myId: string): { sql: string; params: string[] } {
  if (myId.length === 0) {
    return {
      sql: `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${FriendRequestCol.id}, ${FriendRequestCol.fromUserId},
                 ${FriendRequestCol.toUserId}, ${FriendRequestCol.status},
                 ${FriendRequestCol.message}, ${FriendRequestCol.createdAt},
                 ${FriendRequestCol.updatedAt}, ${FriendRequestCol.respondedAt}
          FROM ${FRIEND_REQUESTS_TABLE.tableName}
          WHERE ${FriendRequestCol.toUserId} = ?
            AND ${FriendRequestCol.status} = 'pending'
          ORDER BY ${FriendRequestCol.createdAt} DESC`,
    params: [myId],
  };
}

function pendingOutgoingSql(myId: string): { sql: string; params: string[] } {
  if (myId.length === 0) {
    return {
      sql: `SELECT * FROM ${FRIEND_REQUESTS_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${FriendRequestCol.id}, ${FriendRequestCol.fromUserId},
                 ${FriendRequestCol.toUserId}, ${FriendRequestCol.status},
                 ${FriendRequestCol.message}, ${FriendRequestCol.createdAt},
                 ${FriendRequestCol.updatedAt}, ${FriendRequestCol.respondedAt}
          FROM ${FRIEND_REQUESTS_TABLE.tableName}
          WHERE ${FriendRequestCol.fromUserId} = ?
            AND ${FriendRequestCol.status} = 'pending'
          ORDER BY ${FriendRequestCol.createdAt} DESC`,
    params: [myId],
  };
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
  const myId = useMyId();
  const query = useMemo(() => pendingIncomingSql(myId), [myId]);
  const { rows, isLoading } = useWatchQuery<FriendRequestRow>(
    query.sql,
    query.params
  );
  const requests = useMemo(() => rows.map(mapRequestRow), [rows]);
  return { requests, isLoading: myId.length === 0 ? false : isLoading };
}

export function useOutgoingFriendRequests(): {
  requests: readonly FriendRequest[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const query = useMemo(() => pendingOutgoingSql(myId), [myId]);
  const { rows, isLoading } = useWatchQuery<FriendRequestRow>(
    query.sql,
    query.params
  );
  const requests = useMemo(() => rows.map(mapRequestRow), [rows]);
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
