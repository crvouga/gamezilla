import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import {
  FRIENDS_BLOCKED,
  FRIENDS_FORBIDDEN,
  FRIENDS_NOT_FOUND,
} from '@libs/friends/shared/rules/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { canonicalUserPair } from '../canonical-pair';
import { publishFriendEvent } from '../friend-events';
import type { FriendRequest } from '../friends-types';
import {
  asObjectRecord,
  isoNow,
  requireNonEmptyString,
  requireSignedIn,
} from '../friends-sql/friend-write-helpers';
import {
  findFriendRequestById,
  findPendingRequestsBetweenPair,
  markFriendRequestStatus,
} from '../friends-sql/friend-request-sql';
import {
  insertFriendship,
  isBlockedEitherDirection,
} from '../friends-sql/friendship-block-sql';

export type AcceptFriendRequestInput = {
  readonly requestId: string;
};

export function parseAcceptFriendRequestInput(
  raw: unknown
): AcceptFriendRequestInput {
  const record = asObjectRecord(raw, 'accept friend request input');
  const requestId = requireNonEmptyString(record['requestId'], 'requestId');
  return { requestId };
}

export async function authorizeAccept(
  auth: AppRulesAuth,
  input: AcceptFriendRequestInput,
  sql: SqlClient
): Promise<void> {
  requireSignedIn(auth);
  const request = await findFriendRequestById(sql, input.requestId);
  if (request === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  if (request.toUserId !== auth.userId) {
    throwRulesReject([
      fail(FRIENDS_FORBIDDEN, {
        params: { message: 'Cannot accept this request' },
      }),
    ]);
  }
}

export function acceptFriendRequestBeforeBatch(
  input: AcceptFriendRequestInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'patch',
        table: 'friend_requests',
        id: input.requestId,
        values: { status: 'accepted' },
      },
    ],
  };
}

async function applyAccept(
  sql: SqlClient,
  args: {
    readonly actorId: string;
    readonly otherUserId: string;
    readonly requestId: string;
    readonly now: string;
  }
): Promise<void> {
  const pending = await findPendingRequestsBetweenPair(
    sql,
    args.actorId,
    args.otherUserId
  );
  for (const pendingRequest of pending) {
    await markFriendRequestStatus(sql, pendingRequest.id, 'accepted', args.now);
  }
  await insertFriendship(sql, {
    userA: args.actorId,
    userB: args.otherUserId,
    sourceRequestId: args.requestId,
    now: args.now,
  });
}

export async function acceptFriendRequest(
  auth: AppRulesAuth,
  input: AcceptFriendRequestInput,
  sql: SqlClient
): Promise<{ readonly request: FriendRequest; readonly accepted: boolean }> {
  const request = await findFriendRequestById(sql, input.requestId);
  if (request === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  if (request.status !== 'pending') {
    if (request.status === 'accepted') {
      return { request, accepted: false };
    }
    throwRulesReject([
      fail(FRIENDS_FORBIDDEN, {
        params: { message: 'Friend request is not pending' },
      }),
    ]);
  }
  if (request.toUserId !== auth.userId) {
    throwRulesReject([
      fail(FRIENDS_FORBIDDEN, {
        params: { message: 'Cannot accept this request' },
      }),
    ]);
  }
  const otherUserId = request.fromUserId;
  const block = await isBlockedEitherDirection(sql, auth.userId, otherUserId);
  if (block !== 'none') {
    throwRulesReject([fail(FRIENDS_BLOCKED)]);
  }
  const now = isoNow();
  await applyAccept(sql, {
    actorId: auth.userId,
    otherUserId,
    requestId: input.requestId,
    now,
  });
  const updated = await findFriendRequestById(sql, input.requestId);
  if (updated === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  return { request: updated, accepted: true };
}

export function publishAcceptFriendRequestEvent(
  auth: AppRulesAuth,
  request: FriendRequest
): void {
  const { userLow, userHigh } = canonicalUserPair(auth.userId, request.fromUserId);
  publishFriendEvent({
    type: 'friend.request.accepted',
    requestId: request.id,
    userLow,
    userHigh,
  });
}
