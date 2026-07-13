import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import type { FriendRequest } from '../friends-types';
import {
  authorizeSignedIn,
  isoNow,
  parseFriendRequestIdInput,
  type FriendRequestIdInput,
} from '../friends-sql/friend-write-helpers';
import {
  findFriendRequestById,
  markFriendRequestStatus,
} from '../friends-sql/friend-request-sql';

export type { FriendRequestIdInput };

export const cancelFriendRequestWrite = defineWrite<
  FriendRequestIdInput,
  FriendRequest
>({
  name: 'friends.cancelRequest',
  parseInput: parseFriendRequestIdInput,
  authorize: async (ctx, input, sql) => {
    const signedIn = authorizeSignedIn(ctx);
    if (!signedIn.ok) return signedIn;
    const request = await findFriendRequestById(sql, input.requestId);
    if (request === null) {
      return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
    }
    if (request.fromUserId !== ctx.myId) {
      return fail('FRIENDS_FORBIDDEN', 'Cannot cancel this request');
    }
    return ok(undefined);
  },
  execute: async (ctx, input, sql) => {
    const request = await findFriendRequestById(sql, input.requestId);
    if (request === null) {
      return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
    }
    if (request.fromUserId !== ctx.myId) {
      return fail('FRIENDS_FORBIDDEN', 'Cannot cancel this request');
    }
    if (request.status !== 'pending') return ok(request);
    const now = isoNow();
    await markFriendRequestStatus(sql, input.requestId, 'cancelled', now);
    const updated = await findFriendRequestById(sql, input.requestId);
    if (updated === null) {
      return fail('FRIENDS_NOT_FOUND', 'Friend request not found');
    }
    return ok(updated);
  },
});
