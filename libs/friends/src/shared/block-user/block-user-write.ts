import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { publishFriendEvent } from '../friend-events';
import { pairId } from '../pair-id';
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
export { parseFriendUserIdInput };

export function blockUserBeforeBatch(
  auth: AppRulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'put',
        table: 'user_blocks',
        id: pairId(auth.userId, input.userId),
        values: {
          id: pairId(auth.userId, input.userId),
          blocker_id: auth.userId,
          blocked_id: input.userId,
        },
      },
    ],
  };
}

export async function blockUser(
  auth: AppRulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(auth, input.userId, 'Cannot block yourself');
  const now = isoNow();
  await deleteFriendship(sql, auth.userId, input.userId);
  await cancelPendingRequestsBetween(sql, auth.userId, input.userId, now);
  await insertBlock(sql, auth.userId, input.userId, now);
}

export function publishBlockUserEvent(
  auth: AppRulesAuth,
  userId: string
): void {
  publishFriendEvent({
    type: 'friend.blocked',
    blockerId: auth.userId,
    blockedId: userId,
  });
}
