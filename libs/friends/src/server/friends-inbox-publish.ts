import { readProfileCardById } from '@libs/profile/server/read-profile';
import {
  deactivateInteraction,
  type PublishInteractionInput,
  publishInteraction,
} from '@pkgs/inbox/server/publish';
import { getIo } from '@pkgs/io/als';
import { Sounds } from '@pkgs/sounds/sound-id';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { FriendRequest } from '../shared/friends-types';
import { findPendingRequestsBetweenPair } from './friend-repository';
import { listPendingIncomingRequests } from './friend-request-read';

const FRIENDS_NAMESPACE = 'friends' as const;
const FRIEND_REQUEST_TYPE = 'friend-request' as const;
const FRIEND_ACCEPTED_TYPE = 'friend-request-accepted' as const;

function friendRequestSource(requestId: string) {
  return {
    namespace: FRIENDS_NAMESPACE,
    type: FRIEND_REQUEST_TYPE,
    id: requestId,
  };
}

function friendAcceptedSource(requestId: string) {
  return {
    namespace: FRIENDS_NAMESPACE,
    type: FRIEND_ACCEPTED_TYPE,
    id: requestId,
  };
}

function formatUsernameLabel(username: string): string {
  if (username.length === 0) return 'Someone';
  return `@${username}`;
}

async function loadActorProfile(
  sql: SqlClient,
  userId: string
): Promise<{
  username: string;
  avatarConfig: string | null;
}> {
  const card = await readProfileCardById(sql, userId);
  if (card === null) {
    return { username: '', avatarConfig: null };
  }
  return {
    username: card.username,
    avatarConfig: card.avatarConfig,
  };
}

function profilePresentation(
  profile: { username: string; avatarConfig: string | null },
  title: string,
  userId: string
): PublishInteractionInput['presentation'] {
  const label = formatUsernameLabel(profile.username);
  return {
    title,
    ...(profile.username.length > 0 ? { subtitle: label } : {}),
    avatar: {
      fallbackLabel: label,
      avatarConfig: profile.avatarConfig,
    },
    deepLink: {
      path: '/profile/user/[userId]',
      params: {
        userId,
        username: profile.username,
        avatarConfig: profile.avatarConfig ?? '',
      },
    },
  };
}

export async function publishIncomingFriendRequestInteraction(
  sql: SqlClient,
  request: FriendRequest
): Promise<void> {
  const fromProfile = await loadActorProfile(sql, request.fromUserId);
  const input: PublishInteractionInput = {
    userId: request.toUserId,
    source: friendRequestSource(request.id),
    category: 'action_required',
    presentation: profilePresentation(
      fromProfile,
      `${formatUsernameLabel(fromProfile.username)} sent you a friend request`,
      request.fromUserId
    ),
    actions: [
      {
        id: 'accept',
        label: 'Confirm',
        variant: 'solid',
        soundKey: Sounds.social.friendRequestAccepted,
      },
      {
        id: 'decline',
        label: 'Delete',
        variant: 'outline',
        destructive: true,
      },
    ],
    payload: {
      requestId: request.id,
      fromUserId: request.fromUserId,
    },
    groupKey: 'friends:requests',
    priority: 10,
  };
  const io = getIo();
  await publishInteraction(sql, input, io.clock.now, io.createId);
}

export async function publishFriendRequestAcceptedInteraction(
  sql: SqlClient,
  request: FriendRequest
): Promise<void> {
  const accepterProfile = await loadActorProfile(sql, request.toUserId);
  const io = getIo();
  await publishInteraction(
    sql,
    {
      userId: request.fromUserId,
      source: friendAcceptedSource(request.id),
      category: 'informational',
      presentation: profilePresentation(
        accepterProfile,
        `${formatUsernameLabel(accepterProfile.username)} accepted your friend request`,
        request.toUserId
      ),
      actions: [],
      payload: {
        requestId: request.id,
        toUserId: request.toUserId,
      },
      groupKey: 'friends:accepted',
      priority: 5,
    },
    io.clock.now,
    io.createId
  );
}

export async function deactivateFriendRequestInteraction(
  sql: SqlClient,
  request: Pick<FriendRequest, 'id' | 'toUserId'>
): Promise<void> {
  await deactivateInteraction(
    sql,
    {
      userId: request.toUserId,
      source: friendRequestSource(request.id),
    },
    getIo().clock.now
  );
}

export async function deactivatePendingFriendRequestInteractionsBetween(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  const pending = await findPendingRequestsBetweenPair(sql, userA, userB);
  for (const request of pending) {
    await deactivateFriendRequestInteraction(sql, request);
  }
}

export async function backfillPendingFriendRequestInteractions(
  sql: SqlClient,
  viewerId: string
): Promise<number> {
  const incoming = await listPendingIncomingRequests(sql, viewerId);
  for (const request of incoming) {
    await publishIncomingFriendRequestInteraction(sql, request);
  }
  return incoming.length;
}
