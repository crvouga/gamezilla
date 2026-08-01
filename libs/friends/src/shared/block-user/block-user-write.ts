import type { RulesAuth } from '@pkgs/rules/core/types';
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
  auth: RulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'put',
        table: 'user_blocks',
        id: pairId(auth.myId, input.userId),
        values: {
          id: pairId(auth.myId, input.userId),
          blocker_id: auth.myId,
          blocked_id: input.userId,
        },
      },
    ],
  };
}

export async function blockUser(
  auth: RulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(auth, input.userId, 'Cannot block yourself');
  const now = isoNow();
  await deleteFriendship(sql, auth.myId, input.userId);
  await cancelPendingRequestsBetween(sql, auth.myId, input.userId, now);
  await insertBlock(sql, auth.myId, input.userId, now);
}

export function publishBlockUserEvent(
  auth: RulesAuth,
  userId: string
): void {
  publishFriendEvent({
    type: 'friend.blocked',
    blockerId: auth.myId,
    blockedId: userId,
  });
}
