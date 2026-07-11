import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { FriendRequest, FriendshipStatus, UserSearchResult } from '../shared/friends-types';
import { friendsApiJson, type FriendsApiFetch } from './friends-api';

export type FriendsClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
};

export async function searchUsers(
  deps: FriendsClientDeps,
  query: string,
  limit?: number
): Promise<readonly UserSearchResult[]> {
  const body = await friendsApiJson<{ results: UserSearchResult[] }>({
    ...deps,
    path: '/friends/search',
    init: {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    },
  });
  return body.results;
}

export async function fetchFriendshipStatus(
  deps: FriendsClientDeps,
  userId: string
): Promise<FriendshipStatus> {
  const body = await friendsApiJson<{ status: FriendshipStatus }>({
    ...deps,
    path: `/friends/status/${encodeURIComponent(userId)}`,
    init: { method: 'GET' },
  });
  return body.status;
}

export async function sendFriendRequest(
  deps: FriendsClientDeps,
  toUserId: string,
  message?: string | null
): Promise<FriendRequest> {
  const body = await friendsApiJson<{ request: FriendRequest }>({
    ...deps,
    path: '/friends/requests',
    init: {
      method: 'POST',
      body: JSON.stringify({ toUserId, message: message ?? null }),
    },
  });
  return body.request;
}

export async function acceptFriendRequest(
  deps: FriendsClientDeps,
  requestId: string
): Promise<FriendRequest> {
  const body = await friendsApiJson<{ request: FriendRequest }>({
    ...deps,
    path: `/friends/requests/${encodeURIComponent(requestId)}/accept`,
    init: { method: 'POST' },
  });
  return body.request;
}

export async function declineFriendRequest(
  deps: FriendsClientDeps,
  requestId: string
): Promise<FriendRequest> {
  const body = await friendsApiJson<{ request: FriendRequest }>({
    ...deps,
    path: `/friends/requests/${encodeURIComponent(requestId)}/decline`,
    init: { method: 'POST' },
  });
  return body.request;
}

export async function cancelFriendRequest(
  deps: FriendsClientDeps,
  requestId: string
): Promise<FriendRequest> {
  const body = await friendsApiJson<{ request: FriendRequest }>({
    ...deps,
    path: `/friends/requests/${encodeURIComponent(requestId)}/cancel`,
    init: { method: 'POST' },
  });
  return body.request;
}

export async function removeFriend(
  deps: FriendsClientDeps,
  userId: string
): Promise<void> {
  await friendsApiJson<{ ok: true }>({
    ...deps,
    path: `/friends/${encodeURIComponent(userId)}`,
    init: { method: 'DELETE' },
  });
}

export async function blockUser(
  deps: FriendsClientDeps,
  userId: string
): Promise<void> {
  await friendsApiJson<{ ok: true }>({
    ...deps,
    path: '/friends/blocks',
    init: {
      method: 'POST',
      body: JSON.stringify({ userId }),
    },
  });
}

export async function unblockUser(
  deps: FriendsClientDeps,
  userId: string
): Promise<void> {
  await friendsApiJson<{ ok: true }>({
    ...deps,
    path: `/friends/blocks/${encodeURIComponent(userId)}`,
    init: { method: 'DELETE' },
  });
}
