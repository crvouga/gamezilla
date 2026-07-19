import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import { publishFriendEvent } from '../friend-events';
import {
  FRIEND_REQUEST_RESEND_COOLDOWN_MS,
  type FriendRequest,
} from '../friends-types';
import {
  asObjectRecord,
  authorizeSignedInNotSelf,
  isoNow,
} from '../friends-sql/friend-write-helpers';
import {
  findLatestDeclinedRequestBetween,
  findPendingRequestBetween,
  insertFriendRequest,
} from '../friends-sql/friend-request-sql';
import {
  friendshipExists,
  isBlockedEitherDirection,
} from '../friends-sql/friendship-block-sql';

export type SendFriendRequestInput = {
  readonly toUserId: string;
  readonly message?: string | null;
};

function isResendCooldownActive(respondedAt: string | null): boolean {
  if (respondedAt === null || respondedAt.length === 0) return false;
  const respondedMs = Date.parse(respondedAt);
  if (!Number.isFinite(respondedMs)) return false;
  return Date.now() - respondedMs < FRIEND_REQUEST_RESEND_COOLDOWN_MS;
}

export function parseSendFriendRequestInput(
  raw: unknown
): ReturnType<typeof ok<SendFriendRequestInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'send friend request input');
  if (!record.ok) return record;
  const toUserId = record.value['toUserId'];
  if (typeof toUserId !== 'string' || toUserId.length === 0) {
    return fail('INVALID_INPUT', 'toUserId is required');
  }
  const message = record.value['message'];
  return ok({
    toUserId,
    ...(typeof message === 'string' ? { message } : {}),
  });
}

export const sendFriendRequestWrite = defineWrite<
  SendFriendRequestInput,
  FriendRequest
>({
  name: 'friends.sendRequest',
  parseInput: parseSendFriendRequestInput,
  authorize: async (ctx, input) =>
    authorizeSignedInNotSelf(
      ctx,
      input.toUserId,
      'Cannot perform this action on yourself'
    ),
  execute: async (ctx, input, sql) => {
    const fromUserId = ctx.myId;
    const toUserId = input.toUserId;
    const block = await isBlockedEitherDirection(sql, fromUserId, toUserId);
    if (block !== 'none') {
      return fail('FRIENDS_BLOCKED', 'User is blocked');
    }
    if (await friendshipExists(sql, fromUserId, toUserId)) {
      return fail('FRIENDS_ALREADY_FRIENDS', 'Already friends');
    }
    const outgoing = await findPendingRequestBetween(sql, fromUserId, toUserId);
    if (outgoing !== null) return ok(outgoing);
    const incoming = await findPendingRequestBetween(sql, toUserId, fromUserId);
    if (incoming !== null) {
      return fail(
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
      return fail(
        'FRIENDS_COOLDOWN',
        'Please wait before sending another request'
      );
    }
    const now = isoNow();
    const message =
      typeof input.message === 'string' ? input.message.slice(0, 200) : null;
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
    return ok(request);
  },
});
