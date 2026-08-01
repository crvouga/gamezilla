import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
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
  auth: AppRulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'delete',
        table: 'user_blocks',
        id: pairId(auth.userId, input.userId),
        values: { blocker_id: auth.userId, blocked_id: input.userId },
      },
    ],
  };
}

export async function unblockUser(
  auth: AppRulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(auth, input.userId, 'Cannot unblock yourself');
  await deleteBlock(sql, auth.userId, input.userId);
}
