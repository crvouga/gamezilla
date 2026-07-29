export type FriendshipStatus =
  | 'none'
  | 'friends'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'blocked_by_me'
  | 'blocked_by_them';

export type FriendProfile = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

export type FriendRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled';

export type FriendRequest = {
  readonly id: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly status: FriendRequestStatus;
  readonly message: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly respondedAt: string | null;
};

export type Friend = FriendProfile & {
  readonly friendsSince: string;
};

export type EnrichedFriendRequest = FriendRequest & {
  readonly otherUser: FriendProfile;
};

export type FriendRequestsSummary = {
  readonly incoming: readonly EnrichedFriendRequest[];
  readonly outgoing: readonly EnrichedFriendRequest[];
};

export const FRIEND_REQUEST_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
