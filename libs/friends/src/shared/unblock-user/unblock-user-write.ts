import { ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  authorizeSignedInNotSelf,
  parseFriendUserIdInput,
  type FriendUserIdInput,
} from '../friends-sql/friend-write-helpers';
import { deleteBlock } from '../friends-sql/friendship-block-sql';

export type { FriendUserIdInput };

export const unblockUserWrite = defineWrite<FriendUserIdInput, void>({
  name: 'friends.unblock',
  parseInput: parseFriendUserIdInput,
  authorize: async (ctx, input) =>
    authorizeSignedInNotSelf(ctx, input.userId, 'Cannot unblock yourself'),
  execute: async (ctx, input, sql) => {
    await deleteBlock(sql, ctx.myId, input.userId);
    return ok(undefined);
  },
});
