import { ProfileReadRepository } from '@libs/profile/server/read-profile';
import {
  deactivateInteraction,
  type PublishInteractionInput,
  publishInteraction,
} from '@pkgs/inbox/server/publish';
import { Sounds } from '@pkgs/sounds/sound-id';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { FriendRequestRepository } from '../shared/friends-sql/friend-request-repository';
import type { FriendRequest } from '../shared/friends-types';

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

export class FriendsInboxPublisher {
  private readonly requestRepo: FriendRequestRepository;
  private readonly profileRepo: ProfileReadRepository;

  constructor(
    private readonly sql: SqlClient,
    private readonly now: () => number,
    private readonly createId: CreateId
  ) {
    this.requestRepo = new FriendRequestRepository(sql);
    this.profileRepo = new ProfileReadRepository(sql);
  }

  private async loadActorProfile(userId: string): Promise<{
    username: string;
    avatarConfig: string | null;
  }> {
    const card = await this.profileRepo.readCardById(userId);
    if (card === null) {
      return { username: '', avatarConfig: null };
    }
    return {
      username: card.username,
      avatarConfig: card.avatarConfig,
    };
  }

  async publishIncoming(request: FriendRequest): Promise<void> {
    const fromProfile = await this.loadActorProfile(request.fromUserId);
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
    await publishInteraction(this.sql, input, this.now, this.createId);
  }

  async publishAccepted(request: FriendRequest): Promise<void> {
    const accepterProfile = await this.loadActorProfile(request.toUserId);
    await publishInteraction(
      this.sql,
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
      this.now,
      this.createId
    );
  }

  async deactivate(
    request: Pick<FriendRequest, 'id' | 'toUserId'>
  ): Promise<void> {
    await deactivateInteraction(
      this.sql,
      {
        userId: request.toUserId,
        source: friendRequestSource(request.id),
      },
      this.now
    );
  }

  async deactivatePendingInteractionsBetween(
    userA: string,
    userB: string
  ): Promise<void> {
    const pending = await this.requestRepo.findPendingBetweenPair(userA, userB);
    for (const request of pending) {
      await this.deactivate(request);
    }
  }

  async backfillPendingIncoming(viewerId: string): Promise<number> {
    const incoming = await this.requestRepo.listPendingIncoming(viewerId);
    for (const request of incoming) {
      await this.publishIncoming(request);
    }
    return incoming.length;
  }
}
