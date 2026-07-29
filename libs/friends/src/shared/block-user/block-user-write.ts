import { ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import { publishFriendEvent } from '../friend-events';
import {
  authorizeSignedInNotSelf,
  isoNow,
  parseFriendUserIdInput,
  type FriendUserIdInput,
} from '../friends-sql/friend-write-helpers';
import { cancelPendingRequestsBetween } from '../friends-sql/friend-request-sql';
import {
  deleteFriendship,
  insertBlock,
} from '../friends-sql/friendship-block-sql';

export type { FriendUserIdInput };

export const blockUserWrite = defineWrite<FriendUserIdInput, void>({
  name: 'friends.block',
  parseInput: parseFriendUserIdInput,
  authorize: async (ctx, input) =>
    authorizeSignedInNotSelf(ctx, input.userId, 'Cannot block yourself'),
  execute: async (ctx, input, sql) => {
    const now = isoNow();
    await sql.transaction(async (tx) => {
      await deleteFriendship(tx, ctx.myId, input.userId);
      await cancelPendingRequestsBetween(tx, ctx.myId, input.userId, now);
      await insertBlock(tx, ctx.myId, input.userId, now);
    });
    publishFriendEvent({
      type: 'friend.blocked',
      blockerId: ctx.myId,
      blockedId: input.userId,
    });
    return ok(undefined);
  },
});
