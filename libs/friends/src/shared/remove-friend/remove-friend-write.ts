import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import { canonicalUserPair } from '../canonical-pair';
import { publishFriendEvent } from '../friend-events';
import {
  authorizeSignedInNotSelf,
  parseFriendUserIdInput,
  type FriendUserIdInput,
} from '../friends-sql/friend-write-helpers';
import { clearFriendProfileCaches } from '../friends-sql/friend-profile-cache-sql';
import {
  deleteFriendship,
  friendshipExists,
} from '../friends-sql/friendship-block-sql';

export type { FriendUserIdInput };

export const removeFriendWrite = defineWrite<FriendUserIdInput, void>({
  name: 'friends.remove',
  parseInput: parseFriendUserIdInput,
  authorize: async (ctx, input) =>
    authorizeSignedInNotSelf(
      ctx,
      input.userId,
      'Cannot perform this action on yourself'
    ),
  execute: async (ctx, input, sql) => {
    if (!(await friendshipExists(sql, ctx.myId, input.userId))) {
      return fail('FRIENDS_NOT_FOUND', 'Friendship not found');
    }
    const { userLow, userHigh } = canonicalUserPair(ctx.myId, input.userId);
    await sql.transaction(async (tx) => {
      await deleteFriendship(tx, ctx.myId, input.userId);
      await clearFriendProfileCaches(tx, ctx.myId, input.userId);
    });
    publishFriendEvent({ type: 'friend.removed', userLow, userHigh });
    return ok(undefined);
  },
});
