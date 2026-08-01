import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import {
  FRIENDS_ALREADY_FRIENDS,
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_REQUEST_EXISTS,
} from '@pkgs/rules/friends/codes';
import { isResendCooldownActive } from '@pkgs/rules/friends/cooldown';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { publishFriendEvent } from '../friend-events';
import type { FriendRequest } from '../friends-types';
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

export function parseSendFriendRequestInput(
  raw: unknown
): SendFriendRequestInput {
  const record = asObjectRecord(raw, 'send friend request input');
  const toUserId = record['toUserId'];
  if (typeof toUserId !== 'string' || toUserId.length === 0) {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: 'toUserId is required' } }),
    ]);
  }
  const message = record['message'];
  return {
    toUserId,
    ...(typeof message === 'string' ? { message } : {}),
  };
}

export function sendFriendRequestBeforeBatch(
  auth: RulesAuth,
  input: SendFriendRequestInput,
  requestId: string
): UploadBatch {
  return {
    rows: [
      {
        op: 'put',
        table: 'friend_requests',
        id: requestId,
        values: {
          id: requestId,
          from_user_id: auth.myId,
          to_user_id: input.toUserId,
          status: 'pending',
        },
      },
    ],
  };
}

export async function sendFriendRequest(
  auth: RulesAuth,
  input: SendFriendRequestInput,
  sql: SqlClient
): Promise<{ readonly request: FriendRequest; readonly created: boolean }> {
  authorizeSignedInNotSelf(
    auth,
    input.toUserId,
    'Cannot perform this action on yourself'
  );
  const fromUserId = auth.myId;
  const toUserId = input.toUserId;
  const block = await isBlockedEitherDirection(sql, fromUserId, toUserId);
  if (block !== 'none') {
    throwRulesReject([fail(FRIENDS_BLOCKED)]);
  }
  if (await friendshipExists(sql, fromUserId, toUserId)) {
    throwRulesReject([fail(FRIENDS_ALREADY_FRIENDS)]);
  }
  const outgoing = await findPendingRequestBetween(sql, fromUserId, toUserId);
  if (outgoing !== null) {
    return { request: outgoing, created: false };
  }
  const incoming = await findPendingRequestBetween(sql, toUserId, fromUserId);
  if (incoming !== null) {
    throwRulesReject([fail(FRIENDS_REQUEST_EXISTS)]);
  }
  const declined = await findLatestDeclinedRequestBetween(
    sql,
    fromUserId,
    toUserId
  );
  if (declined !== null && isResendCooldownActive(declined.respondedAt)) {
    throwRulesReject([fail(FRIENDS_COOLDOWN)]);
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
  return { request, created: true };
}

/** Publish after a successful create (call-site side effect). */
export function publishSendFriendRequestEvent(request: FriendRequest): void {
  publishFriendEvent({
    type: 'friend.request.sent',
    requestId: request.id,
    fromUserId: request.fromUserId,
    toUserId: request.toUserId,
  });
}
