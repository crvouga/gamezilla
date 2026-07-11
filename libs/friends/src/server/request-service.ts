import type { SqlClient } from '@pkgs/sql-client/interface';

import { publishFriendEvent } from '../shared/friend-events';
import { FriendsError } from '../shared/friends-errors';
import {
  FRIEND_REQUEST_RESEND_COOLDOWN_MS,
  type FriendRequest,
  type FriendshipStatus,
} from '../shared/friends-types';
import { canonicalUserPair } from '../shared/canonical-pair';
import {
  cancelPendingRequestsBetween,
  deleteFriendship,
  findFriendRequestById,
  findLatestDeclinedRequestBetween,
  findPendingRequestBetween,
  findPendingRequestsBetweenPair,
  friendshipExists,
  insertFriendRequest,
  insertFriendship,
  isBlockedEitherDirection,
  markFriendRequestStatus,
} from './friend-repository';
import {
  clearFriendProfileCaches,
  syncFriendProfileCaches,
} from './profile-projection-service';

function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new FriendsError(
      'FRIENDS_SELF',
      'Cannot perform this action on yourself'
    );
  }
}

async function assertNotBlocked(
  sql: SqlClient,
  actorId: string,
  targetId: string
): Promise<void> {
  const block = await isBlockedEitherDirection(sql, actorId, targetId);
  if (block !== 'none') {
    throw new FriendsError('FRIENDS_BLOCKED', 'User is blocked');
  }
}

function isResendCooldownActive(respondedAt: string | null): boolean {
  if (respondedAt === null || respondedAt.length === 0) return false;
  const respondedMs = Date.parse(respondedAt);
  if (!Number.isFinite(respondedMs)) return false;
  return Date.now() - respondedMs < FRIEND_REQUEST_RESEND_COOLDOWN_MS;
}

export async function sendFriendRequest(
  sql: SqlClient,
  fromUserId: string,
  toUserId: string,
  message: string | null
): Promise<FriendRequest> {
  assertNotSelf(fromUserId, toUserId);
  await assertNotBlocked(sql, fromUserId, toUserId);
  if (await friendshipExists(sql, fromUserId, toUserId)) {
    throw new FriendsError('FRIENDS_ALREADY_FRIENDS', 'Already friends');
  }
  const outgoing = await findPendingRequestBetween(sql, fromUserId, toUserId);
  if (outgoing !== null) return outgoing;
  const incoming = await findPendingRequestBetween(sql, toUserId, fromUserId);
  if (incoming !== null) {
    throw new FriendsError(
      'FRIENDS_REQUEST_EXISTS',
      'This user already sent you a friend request'
    );
  }
  const declined = await findLatestDeclinedRequestBetween(
    sql,
    fromUserId,
    toUserId
  );
  if (declined !== null && isResendCooldownActive(declined.respondedAt)) {
    throw new FriendsError(
      'FRIENDS_COOLDOWN',
      'Please wait before sending another request'
    );
  }
  const now = new Date().toISOString();
  const request = await insertFriendRequest(sql, {
    id: crypto.randomUUID(),
    fromUserId,
    toUserId,
    message,
    now,
  });
  publishFriendEvent({
    type: 'friend.request.sent',
    requestId: request.id,
    fromUserId,
    toUserId,
  });
  return request;
}

async function acceptRequestsAndCreateFriendship(
  sql: SqlClient,
  actorId: string,
  otherUserId: string,
  primaryRequestId: string
): Promise<void> {
  const now = new Date().toISOString();
  const pending = await findPendingRequestsBetweenPair(
    sql,
    actorId,
    otherUserId
  );
  for (const request of pending) {
    await markFriendRequestStatus(sql, request.id, 'accepted', now);
  }
  await insertFriendship(sql, {
    userA: actorId,
    userB: otherUserId,
    sourceRequestId: primaryRequestId,
    now,
  });
  await syncFriendProfileCaches(sql, actorId, otherUserId, now);
  const { userLow, userHigh } = canonicalUserPair(actorId, otherUserId);
  publishFriendEvent({
    type: 'friend.request.accepted',
    requestId: primaryRequestId,
    userLow,
    userHigh,
  });
}

export async function acceptFriendRequest(
  sql: SqlClient,
  actorId: string,
  requestId: string
): Promise<FriendRequest> {
  const request = await findFriendRequestById(sql, requestId);
  if (request === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  if (request.status !== 'pending') {
    if (request.status === 'accepted') return request;
    throw new FriendsError(
      'FRIENDS_FORBIDDEN',
      'Friend request is not pending'
    );
  }
  if (request.toUserId !== actorId) {
    throw new FriendsError('FRIENDS_FORBIDDEN', 'Cannot accept this request');
  }
  const otherUserId = request.fromUserId;
  await assertNotBlocked(sql, actorId, otherUserId);
  await sql.transaction(async (tx) => {
    await acceptRequestsAndCreateFriendship(
      tx,
      actorId,
      otherUserId,
      requestId
    );
  });
  const updated = await findFriendRequestById(sql, requestId);
  if (updated === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  return updated;
}

export async function declineFriendRequest(
  sql: SqlClient,
  actorId: string,
  requestId: string
): Promise<FriendRequest> {
  const request = await findFriendRequestById(sql, requestId);
  if (request === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  if (request.toUserId !== actorId) {
    throw new FriendsError('FRIENDS_FORBIDDEN', 'Cannot decline this request');
  }
  if (request.status !== 'pending') return request;
  const now = new Date().toISOString();
  await markFriendRequestStatus(sql, requestId, 'declined', now);
  const updated = await findFriendRequestById(sql, requestId);
  if (updated === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  return updated;
}

export async function cancelFriendRequest(
  sql: SqlClient,
  actorId: string,
  requestId: string
): Promise<FriendRequest> {
  const request = await findFriendRequestById(sql, requestId);
  if (request === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  if (request.fromUserId !== actorId) {
    throw new FriendsError('FRIENDS_FORBIDDEN', 'Cannot cancel this request');
  }
  if (request.status !== 'pending') return request;
  const now = new Date().toISOString();
  await markFriendRequestStatus(sql, requestId, 'cancelled', now);
  const updated = await findFriendRequestById(sql, requestId);
  if (updated === null) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  return updated;
}

export async function removeFriend(
  sql: SqlClient,
  actorId: string,
  friendUserId: string
): Promise<void> {
  assertNotSelf(actorId, friendUserId);
  if (!(await friendshipExists(sql, actorId, friendUserId))) {
    throw new FriendsError('FRIENDS_NOT_FOUND', 'Friendship not found');
  }
  const { userLow, userHigh } = canonicalUserPair(actorId, friendUserId);
  await sql.transaction(async (tx) => {
    await deleteFriendship(tx, actorId, friendUserId);
    await clearFriendProfileCaches(tx, actorId, friendUserId);
  });
  publishFriendEvent({ type: 'friend.removed', userLow, userHigh });
}

export async function resolveFriendshipStatus(
  sql: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<FriendshipStatus> {
  if (viewerId === targetUserId) return 'none';
  const block = await isBlockedEitherDirection(sql, viewerId, targetUserId);
  if (block === 'by_a') return 'blocked_by_me';
  if (block === 'by_b') return 'blocked_by_them';
  if (await friendshipExists(sql, viewerId, targetUserId)) return 'friends';
  const outgoing = await findPendingRequestBetween(sql, viewerId, targetUserId);
  if (outgoing !== null) return 'pending_outgoing';
  const incoming = await findPendingRequestBetween(sql, targetUserId, viewerId);
  if (incoming !== null) return 'pending_incoming';
  return 'none';
}

export { cancelPendingRequestsBetween };
