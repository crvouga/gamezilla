import {
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
} from '@libs/db/shared/friends-tables';
import {
  FRIENDS_BLOCK_OWNER_MISMATCH,
  FRIENDS_FRIENDSHIP_PARTY_REQUIRED,
  FRIENDS_REQUEST_PARTY_REQUIRED,
} from '@libs/friends/shared/rules/codes';
import type { TablePolicy } from '@pkgs/sync-engine/server/apply-batch';
import { tableColumnNames } from '@pkgs/sync-engine/shared/table-definition';
import type { UploadOp } from '@pkgs/sync-engine/shared/upload-batch';

import { deny, ok, readRowString } from './table-policy-helpers';

const PUT_PATCH_DELETE = new Set<UploadOp>(['put', 'patch', 'delete']);

export function friendsTablePolicies(): readonly TablePolicy[] {
  return [
    {
      table: FRIEND_REQUESTS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: new Set(tableColumnNames(FRIEND_REQUESTS_TABLE)),
      authorize: async (auth, row) => {
        const fromUserId = readRowString(row, 'from_user_id');
        const toUserId = readRowString(row, 'to_user_id');
        if (fromUserId === auth.userId || toUserId === auth.userId) return ok();
        return deny(FRIENDS_REQUEST_PARTY_REQUIRED);
      },
    },
    {
      table: FRIENDSHIPS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: new Set(tableColumnNames(FRIENDSHIPS_TABLE)),
      authorize: async (auth, row) => {
        const userLow = readRowString(row, 'user_low');
        const userHigh = readRowString(row, 'user_high');
        if (userLow === auth.userId || userHigh === auth.userId) return ok();
        return deny(FRIENDS_FRIENDSHIP_PARTY_REQUIRED);
      },
    },
    {
      table: USER_BLOCKS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: new Set(tableColumnNames(USER_BLOCKS_TABLE)),
      authorize: async (auth, row) => {
        const blockerId = readRowString(row, 'blocker_id');
        if (blockerId !== auth.userId)
          return deny(FRIENDS_BLOCK_OWNER_MISMATCH);
        return ok();
      },
    },
  ];
}
