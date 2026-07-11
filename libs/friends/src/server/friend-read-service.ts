import { readProfileCardById } from '@libs/profile/server/read-profile';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  EnrichedFriendRequest,
  FriendProfile,
  FriendRequestsSummary,
} from '../shared/friends-types';
import { FriendsError } from '../shared/friends-errors';
import { isBlockedEitherDirection } from './friend-repository';
import {
  listPendingIncomingRequests,
  listPendingOutgoingRequests,
} from './friend-request-read';
import { loadProfileCardsForUserIds } from './profile-projection-service';

function mapProfileCard(card: {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarConfig: string | null;
}): FriendProfile {
  return {
    userId: card.userId,
    username: card.username,
    displayName: card.displayName,
    avatarConfig: card.avatarConfig,
  };
}

async function enrichRequests(
  sql: SqlClient,
  requests: readonly {
    readonly id: string;
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly status: EnrichedFriendRequest['status'];
    readonly message: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly respondedAt: string | null;
  }[],
  otherUserId: (request: { fromUserId: string; toUserId: string }) => string
): Promise<readonly EnrichedFriendRequest[]> {
  if (requests.length === 0) return [];
  const otherIds = [...new Set(requests.map((r) => otherUserId(r)))];
  const cards = await loadProfileCardsForUserIds(sql, otherIds);
  const byId = new Map(cards.map((c) => [c.userId, mapProfileCard(c)]));
  return requests.map((request) => {
    const oid = otherUserId(request);
    const profile = byId.get(oid);
    if (profile === undefined) {
      throw new FriendsError('FRIENDS_NOT_FOUND', 'Profile not found');
    }
    return { ...request, otherUser: profile };
  });
}

export async function listFriendRequestsSummary(
  sql: SqlClient,
  viewerId: string
): Promise<FriendRequestsSummary> {
  const [incomingRaw, outgoingRaw] = await Promise.all([
    listPendingIncomingRequests(sql, viewerId),
    listPendingOutgoingRequests(sql, viewerId),
  ]);
  const [incoming, outgoing] = await Promise.all([
    enrichRequests(sql, incomingRaw, (r) => r.fromUserId),
    enrichRequests(sql, outgoingRaw, (r) => r.toUserId),
  ]);
  return { incoming, outgoing };
}

export async function readFriendUserProfile(
  sql: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<FriendProfile> {
  if (viewerId === targetUserId) {
    throw new FriendsError('FRIENDS_SELF', 'Cannot load your own profile here');
  }
  const block = await isBlockedEitherDirection(sql, viewerId, targetUserId);
  if (block !== 'none') {
    throw new FriendsError('FRIENDS_BLOCKED', 'User is not available');
  }
  const card = await readProfileCardById(sql, targetUserId);
  if (card === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'User not found');
  }
  return mapProfileCard(card);
}
