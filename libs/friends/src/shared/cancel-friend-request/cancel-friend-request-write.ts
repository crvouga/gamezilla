import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import { FRIENDS_FORBIDDEN, FRIENDS_NOT_FOUND } from '@pkgs/rules/friends/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { FriendRequest } from '../friends-types';
import {
  isoNow,
  parseFriendRequestIdInput,
  requireSignedIn,
  type FriendRequestIdInput,
} from '../friends-sql/friend-write-helpers';
import {
  findFriendRequestById,
  markFriendRequestStatus,
} from '../friends-sql/friend-request-sql';

export type { FriendRequestIdInput };
export { parseFriendRequestIdInput };

export async function authorizeCancel(
  auth: RulesAuth,
  input: FriendRequestIdInput,
  sql: SqlClient
): Promise<void> {
  requireSignedIn(auth);
  const request = await findFriendRequestById(sql, input.requestId);
  if (request === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  if (request.fromUserId !== auth.myId) {
    throwRulesReject([
      fail(FRIENDS_FORBIDDEN, {
        params: { message: 'Cannot cancel this request' },
      }),
    ]);
  }
}

export function cancelFriendRequestBeforeBatch(
  input: FriendRequestIdInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'patch',
        table: 'friend_requests',
        id: input.requestId,
        values: { status: 'cancelled' },
      },
    ],
  };
}

export async function cancelFriendRequest(
  auth: RulesAuth,
  input: FriendRequestIdInput,
  sql: SqlClient
): Promise<FriendRequest> {
  const request = await findFriendRequestById(sql, input.requestId);
  if (request === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  if (request.fromUserId !== auth.myId) {
    throwRulesReject([
      fail(FRIENDS_FORBIDDEN, {
        params: { message: 'Cannot cancel this request' },
      }),
    ]);
  }
  if (request.status !== 'pending') return request;
  const now = isoNow();
  await markFriendRequestStatus(sql, input.requestId, 'cancelled', now);
  const updated = await findFriendRequestById(sql, input.requestId);
  if (updated === null) {
    throwRulesReject([
      fail(FRIENDS_NOT_FOUND, {
        params: { message: 'Friend request not found' },
      }),
    ]);
  }
  return updated;
}
