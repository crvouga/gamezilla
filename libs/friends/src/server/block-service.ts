import type { SqlClient } from '@pkgs/sql-client/interface';

import { publishFriendEvent } from '../shared/friend-events';
import { FriendsError } from '../shared/friends-errors';
import {
  cancelPendingRequestsBetween,
  deleteBlock,
  deleteFriendship,
  insertBlock,
} from './friend-repository';
import { deactivatePendingFriendRequestInteractionsBetween } from './friends-inbox-publish';

function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new FriendsError('FRIENDS_SELF', 'Cannot block yourself');
  }
}

export async function blockUser(
  sql: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  assertNotSelf(blockerId, blockedId);
  await deactivatePendingFriendRequestInteractionsBetween(
    sql,
    blockerId,
    blockedId
  );
  await sql.transaction(async (tx) => {
    await deleteFriendship(tx, blockerId, blockedId, now);
    await cancelPendingRequestsBetween(tx, blockerId, blockedId, now);
    await insertBlock(tx, blockerId, blockedId, now);
  });
  publishFriendEvent({ type: 'friend.blocked', blockerId, blockedId });
}

export async function unblockUser(
  sql: SqlClient,
  blockerId: string,
  blockedId: string,
  now: string
): Promise<void> {
  assertNotSelf(blockerId, blockedId);
  await deleteBlock(sql, blockerId, blockedId, now);
}
