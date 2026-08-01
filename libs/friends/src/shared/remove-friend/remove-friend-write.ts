import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { FRIENDS_NOT_FOUND } from '@libs/friends/shared/rules/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { canonicalUserPair } from '../canonical-pair';
import { publishFriendEvent } from '../friend-events';
import { pairId } from '../pair-id';
import {
  authorizeSignedInNotSelf,
  parseFriendUserIdInput,
  type FriendUserIdInput,
} from '../friends-sql/friend-write-helpers';
import {
  deleteFriendship,
  friendshipExists,
} from '../friends-sql/friendship-block-sql';

export type { FriendUserIdInput };
export { parseFriendUserIdInput };

export function removeFriendBeforeBatch(
  auth: AppRulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  const { userLow, userHigh } = canonicalUserPair(auth.userId, input.userId);
  return {
    rows: [
      {
        op: 'delete',
        table: 'friendships',
        id: pairId(userLow, userHigh),
        values: { user_low: userLow, user_high: userHigh },
      },
    ],
  };
}

export async function removeFriend(
  auth: AppRulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(
    auth,
    input.userId,
    'Cannot perform this action on yourself'
  );
  if (!(await friendshipExists(sql, auth.userId, input.userId))) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friendship not found' },
      }),
    ]);
  }
  await deleteFriendship(sql, auth.userId, input.userId);
}

export function publishRemoveFriendEvent(
  auth: AppRulesAuth,
  userId: string
): void {
  const { userLow, userHigh } = canonicalUserPair(auth.userId, userId);
  publishFriendEvent({ type: 'friend.removed', userLow, userHigh });
}
