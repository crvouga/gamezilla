import { fail, ok } from '@pkgs/write/shared/write-result';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { canonicalUserPair } from '../canonical-pair';
import { publishFriendEvent } from '../friend-events';
import type { FriendRequest } from '../friends-types';
import {
  asObjectRecord,
  authorizeSignedIn,
  isoNow,
  requireNonEmptyString,
} from '../friends-sql/friend-write-helpers';
import { syncActorFriendProfileCache } from '../friends-sql/friend-profile-cache-sql';
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
  readonly friendUsername?: string;
  readonly friendAvatarConfig?: string | null;
};

export function parseAcceptFriendRequestInput(
  raw: unknown
): ReturnType<typeof ok<AcceptFriendRequestInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'accept friend request input');
  if (!record.ok) return record;
  const requestId = requireNonEmptyString(
    record.value['requestId'],
    'requestId'
  );
  if (!requestId.ok) return requestId;
  const friendUsername = record.value['friendUsername'];
  const friendAvatarConfig = record.value['friendAvatarConfig'];
  return ok({
    requestId: requestId.value,
    ...(typeof friendUsername === 'string' ? { friendUsername } : {}),
    ...(typeof friendAvatarConfig === 'string' || friendAvatarConfig === null
      ? { friendAvatarConfig }
      : {}),
  });
}

async function authorizeAccept(
  ctx: WriteContext,
  input: AcceptFriendRequestInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const signedIn = authorizeSignedIn(ctx);
  if (!signedIn.ok) return signedIn;
  const request = await findFriendRequestById(sql, input.requestId);
  if (request === null) {
    return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
  }
  if (request.toUserId !== ctx.myId) {
    return fail('FRIENDS_FORBIDDEN', 'Cannot accept this request');
  }
  return ok(undefined);
}

async function applyAccept(
  sql: SqlClient,
  args: {
    readonly actorId: string;
    readonly otherUserId: string;
    readonly requestId: string;
    readonly now: string;
    readonly friendProfile?: {
      readonly username: string;
      readonly avatarConfig: string | null;
    };
  }
): Promise<void> {
  const pending = await findPendingRequestsBetweenPair(
    sql,
    args.actorId,
    args.otherUserId
  );
  for (const pendingRequest of pending) {
    await markFriendRequestStatus(
      sql,
      pendingRequest.id,
      'accepted',
      args.now
    );
  }
  await insertFriendship(sql, {
    userA: args.actorId,
    userB: args.otherUserId,
    sourceRequestId: args.requestId,
    now: args.now,
  });
  await syncActorFriendProfileCache(sql, {
    actorId: args.actorId,
    otherUserId: args.otherUserId,
    now: args.now,
    ...(args.friendProfile !== undefined
      ? { friendProfile: args.friendProfile }
      : {}),
  });
}

export const acceptFriendRequestWrite = defineWrite<
  AcceptFriendRequestInput,
  FriendRequest
>({
  name: 'friends.acceptRequest',
  parseInput: parseAcceptFriendRequestInput,
  authorize: async (ctx, input, sql) => authorizeAccept(ctx, input, sql),
  execute: async (ctx, input, sql) => {
    const request = await findFriendRequestById(sql, input.requestId);
    if (request === null) {
      return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
    }
    if (request.status !== 'pending') {
      if (request.status === 'accepted') return ok(request);
      return fail('FRIENDS_FORBIDDEN', 'Friend request is not pending');
    }
    if (request.toUserId !== ctx.myId) {
      return fail('FRIENDS_FORBIDDEN', 'Cannot accept this request');
    }
    const otherUserId = request.fromUserId;
    const block = await isBlockedEitherDirection(sql, ctx.myId, otherUserId);
    if (block !== 'none') {
      return fail('FRIENDS_BLOCKED', 'User is blocked');
    }
    const now = isoNow();
    const friendProfile =
      typeof input.friendUsername === 'string'
        ? {
            username: input.friendUsername,
            avatarConfig: input.friendAvatarConfig ?? null,
          }
        : undefined;
    await sql.transaction(async (tx) => {
      await applyAccept(tx, {
        actorId: ctx.myId,
        otherUserId,
        requestId: input.requestId,
        now,
        ...(friendProfile !== undefined ? { friendProfile } : {}),
      });
    });
    const updated = await findFriendRequestById(sql, input.requestId);
    if (updated === null) {
      return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
    }
    const { userLow, userHigh } = canonicalUserPair(ctx.myId, otherUserId);
    publishFriendEvent({
      type: 'friend.request.accepted',
      requestId: input.requestId,
      userLow,
      userHigh,
    });
    return ok(updated);
  },
});
