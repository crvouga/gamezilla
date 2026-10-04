import { Notifications } from '@libs/notifications-server/notifications-service';
import type { PublishNotificationInput } from '@libs/notifications-shared/publish-types';
import { ProfileReadRepository } from '@libs/profile-shared/read-profile';
import type { Clock } from '@pkgs/clock-shared/types';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import { Sounds } from '@pkgs/sounds-shared/sound-id';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import {
  FriendRequestAccepted,
  FriendRequestClosed,
  FriendRequestSent,
} from '@libs/friends-shared/friends-outbox-messages';
import { FriendRequestRepository } from '@libs/friends-shared/friend-request-repository';

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
  tx: SqlTx,
  userId: string
): Promise<{ username: string; avatarConfig: string | null }> {
  const card = await new ProfileReadRepository(tx).readCardById(userId);
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
): PublishNotificationInput['presentation'] {
  const label = formatUsernameLabel(profile.username);
  return {
    title,
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

export const friendRequestSentNotifyConsumer = defineOutboxConsumer({
  id: 'friends.notify.request-sent',
  on: FriendRequestSent,
  async handler({ tx, clock, createId }, payload) {
    // Independent outbox deliveries may close a request before its sent event.
    const pending = await new FriendRequestRepository(tx).findPendingBetween(
      payload.fromUserId,
      payload.toUserId
    );
    if (pending?.id !== payload.requestId) return;
    const fromProfile = await loadActorProfile(tx, payload.fromUserId);
    const notifications = new Notifications({ tx, clock, createId });
    await notifications.send({
      userId: payload.toUserId,
      source: friendRequestSource(payload.requestId),
      category: 'action_required',
      presentation: profilePresentation(
        fromProfile,
        `${formatUsernameLabel(fromProfile.username)} sent you a friend request`,
        payload.fromUserId
      ),
      actions: [
        {
          id: 'accept',
          label: 'Accept',
          variant: 'solid',
          soundKey: Sounds.social.friendRequestAccepted,
        },
        {
          id: 'decline',
          label: 'Decline',
          variant: 'ghost',
        },
      ],
      payload: {
        requestId: payload.requestId,
        fromUserId: payload.fromUserId,
        fromUsername: fromProfile.username,
      },
      groupKey: 'friends:requests',
      priority: 10,
    });
    return { notifyUserIds: [payload.toUserId] };
  },
});

export const friendRequestAcceptedNotifyConsumer = defineOutboxConsumer({
  id: 'friends.notify.request-accepted',
  on: FriendRequestAccepted,
  async handler({ tx, clock, createId }, payload) {
    const notifications = new Notifications({ tx, clock, createId });
    await notifications.deactivate({
      userId: payload.toUserId,
      source: friendRequestSource(payload.requestId),
    });
    const accepterProfile = await loadActorProfile(tx, payload.toUserId);
    await notifications.send({
      userId: payload.fromUserId,
      source: friendAcceptedSource(payload.requestId),
      category: 'informational',
      presentation: profilePresentation(
        accepterProfile,
        `${formatUsernameLabel(accepterProfile.username)} accepted your friend request`,
        payload.toUserId
      ),
      actions: [],
      payload: {
        requestId: payload.requestId,
        toUserId: payload.toUserId,
        toUsername: accepterProfile.username,
      },
      groupKey: 'friends:accepted',
      priority: 5,
    });
    return { notifyUserIds: [payload.fromUserId, payload.toUserId] };
  },
});

export const friendRequestClosedNotifyConsumer = defineOutboxConsumer({
  id: 'friends.notify.request-closed',
  on: FriendRequestClosed,
  async handler({ tx, clock, createId }, payload) {
    await new Notifications({ tx, clock, createId }).deactivate({
      userId: payload.toUserId,
      source: friendRequestSource(payload.requestId),
    });
    return { notifyUserIds: [payload.toUserId] };
  },
});

export const FRIENDS_OUTBOX_CONSUMERS = [
  friendRequestSentNotifyConsumer,
  friendRequestAcceptedNotifyConsumer,
  friendRequestClosedNotifyConsumer,
] as const;

/** Used by block flows that clear pending requests without a single request id. */
export async function deactivatePendingFriendNotificationsBetween(
  tx: SqlTx,
  time: { readonly clock: Clock; readonly createId: CreateId },
  userA: string,
  userB: string
): Promise<void> {
  const pending = await new FriendRequestRepository(tx).findPendingBetweenPair(
    userA,
    userB
  );
  const notifications = new Notifications({
    tx,
    clock: time.clock,
    createId: time.createId,
  });
  for (const request of pending) {
    await notifications.deactivate({
      userId: request.toUserId,
      source: friendRequestSource(request.id),
    });
  }
}
