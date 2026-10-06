import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';

const friendsOutboxNs = createMessageNamespace('friends', 'outbox');

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export type FriendRequestSentPayload = {
  readonly requestId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
};

export type FriendRequestAcceptedPayload = {
  readonly requestId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
};

export type FriendRequestClosedPayload = {
  readonly requestId: string;
  readonly toUserId: string;
};

function isFriendRequestSent(p: unknown): p is FriendRequestSentPayload {
  return (
    isPlainRecord(p) &&
    isNonEmptyString(p['requestId']) &&
    isNonEmptyString(p['fromUserId']) &&
    isNonEmptyString(p['toUserId'])
  );
}

function isFriendRequestAccepted(
  p: unknown
): p is FriendRequestAcceptedPayload {
  return isFriendRequestSent(p);
}

function isFriendRequestClosed(p: unknown): p is FriendRequestClosedPayload {
  return (
    isPlainRecord(p) &&
    isNonEmptyString(p['requestId']) &&
    isNonEmptyString(p['toUserId'])
  );
}

export const FriendRequestSent = friendsOutboxNs(
  'request-sent',
  isFriendRequestSent
);

export const FriendRequestAccepted = friendsOutboxNs(
  'request-accepted',
  isFriendRequestAccepted
);

export const FriendRequestClosed = friendsOutboxNs(
  'request-closed',
  isFriendRequestClosed
);

/** Someone blocked or unblocked another person (published: "block someone"). */
export type BlockChangedPayload = {
  readonly blockerId: string;
  readonly blockedId: string;
};

export const BlockChanged = friendsOutboxNs(
  'block-changed',
  (p: unknown): p is BlockChangedPayload =>
    isPlainRecord(p) &&
    isNonEmptyString(p['blockerId']) &&
    isNonEmptyString(p['blockedId'])
);
