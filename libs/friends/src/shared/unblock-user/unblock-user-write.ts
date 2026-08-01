import type { RulesAuth } from '@pkgs/rules/core/types';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { pairId } from '../pair-id';
import {
  authorizeSignedInNotSelf,
  parseFriendUserIdInput,
  type FriendUserIdInput,
} from '../friends-sql/friend-write-helpers';
import { deleteBlock } from '../friends-sql/friendship-block-sql';

export type { FriendUserIdInput };
export { parseFriendUserIdInput };

export function unblockUserBeforeBatch(
  auth: RulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'delete',
        table: 'user_blocks',
        id: pairId(auth.myId, input.userId),
        values: { blocker_id: auth.myId, blocked_id: input.userId },
      },
    ],
  };
}

export async function unblockUser(
  auth: RulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(auth, input.userId, 'Cannot unblock yourself');
  await deleteBlock(sql, auth.myId, input.userId);
}
