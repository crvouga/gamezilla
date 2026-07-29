import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import {
  ownerMatches,
  readRowString,
} from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

const friendRequestsRowWrite = defineRowAuthorizeWrite({
  name: 'friend_requests.patch',
  authorize: async (ctx, row) => {
    const fromUserId = readRowString(row, FriendRequestCol.fromUserId);
    const toUserId = readRowString(row, FriendRequestCol.toUserId);
    if (fromUserId === ctx.myId || toUserId === ctx.myId) {
      return ok(undefined);
    }
    return fail(
      'FRIENDS_REQUEST_PARTY_REQUIRED',
      'not a party to this request'
    );
  },
});

const friendshipsRowWrite = defineRowAuthorizeWrite({
  name: 'friendships.patch',
  authorize: async (ctx, row) => {
    const userLow = readRowString(row, FriendshipCol.userLow);
    const userHigh = readRowString(row, FriendshipCol.userHigh);
    if (userLow === ctx.myId || userHigh === ctx.myId) {
      return ok(undefined);
    }
    return fail(
      'FRIENDS_FRIENDSHIP_PARTY_REQUIRED',
      'not a party to this friendship'
    );
  },
});

const userBlocksRowWrite = defineRowAuthorizeWrite({
  name: 'user_blocks.patch',
  authorize: async (ctx, row) => {
    const blockerId = readRowString(row, UserBlockCol.blockerId);
    return (
      ownerMatches(blockerId, ctx.myId, 'FRIENDS_BLOCK_OWNER_MISMATCH') ??
      ok(undefined)
    );
  },
});

export const FRIENDS_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [FRIEND_REQUESTS_TABLE.tableName]: createRowWriteBinding(
    friendRequestsRowWrite
  ),
  [FRIENDSHIPS_TABLE.tableName]: createRowWriteBinding(friendshipsRowWrite),
  [USER_BLOCKS_TABLE.tableName]: createRowWriteBinding(userBlocksRowWrite),
};
