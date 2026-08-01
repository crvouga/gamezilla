import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  FriendRequestCol,
  FriendshipCol,
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import {
  FRIENDS_BLOCK_OWNER_MISMATCH,
  FRIENDS_FRIENDSHIP_PARTY_REQUIRED,
  FRIENDS_REQUEST_PARTY_REQUIRED,
} from '@libs/friends/shared/rules/codes';
import type { TablePolicy } from '@pkgs/sync-engine/server/apply-batch';
import type { UploadOp } from '@pkgs/sync-engine/shared/upload-batch';

import { columnSet, deny, ok, readRowString } from './table-policy-helpers';

const PUT_PATCH_DELETE = new Set<UploadOp>(['put', 'patch', 'delete']);

export function friendsTablePolicies(): readonly TablePolicy[] {
  return [
    {
      table: FRIEND_REQUESTS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(FriendRequestCol),
      authorize: async (auth, row) => {
        const fromUserId = readRowString(row, FriendRequestCol.fromUserId);
        const toUserId = readRowString(row, FriendRequestCol.toUserId);
        if (fromUserId === auth.userId || toUserId === auth.userId) return ok();
        return deny(FRIENDS_REQUEST_PARTY_REQUIRED);
      },
    },
    {
      table: FRIENDSHIPS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(FriendshipCol),
      authorize: async (auth, row) => {
        const userLow = readRowString(row, FriendshipCol.userLow);
        const userHigh = readRowString(row, FriendshipCol.userHigh);
        if (userLow === auth.userId || userHigh === auth.userId) return ok();
        return deny(FRIENDS_FRIENDSHIP_PARTY_REQUIRED);
      },
    },
    {
      table: USER_BLOCKS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(UserBlockCol),
      authorize: async (auth, row) => {
        const blockerId = readRowString(row, UserBlockCol.blockerId);
        if (blockerId !== auth.userId) return deny(FRIENDS_BLOCK_OWNER_MISMATCH);
        return ok();
      },
    },
  ];
}
