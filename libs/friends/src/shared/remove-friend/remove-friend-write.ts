import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import { FRIENDS_NOT_FOUND } from '@pkgs/rules/friends/codes';
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
  auth: RulesAuth,
  input: FriendUserIdInput
): UploadBatch {
  const { userLow, userHigh } = canonicalUserPair(auth.myId, input.userId);
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
  auth: RulesAuth,
  input: FriendUserIdInput,
  sql: SqlClient
): Promise<void> {
  authorizeSignedInNotSelf(
    auth,
    input.userId,
    'Cannot perform this action on yourself'
  );
  if (!(await friendshipExists(sql, auth.myId, input.userId))) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friendship not found' },
      }),
    ]);
  }
  await deleteFriendship(sql, auth.myId, input.userId);
}

export function publishRemoveFriendEvent(
  auth: RulesAuth,
  userId: string
): void {
  const { userLow, userHigh } = canonicalUserPair(auth.myId, userId);
  publishFriendEvent({ type: 'friend.removed', userLow, userHigh });
}
