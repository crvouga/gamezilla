import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

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

export async function blockUser(args: {
  readonly sql: SqlClient;
  readonly blockerId: string;
  readonly blockedId: string;
  readonly now: string;
  readonly createId: CreateId;
}): Promise<void> {
  const { sql, blockerId, blockedId, now, createId } = args;
  assertNotSelf(blockerId, blockedId);
  await deactivatePendingFriendRequestInteractionsBetween(
    sql,
    blockerId,
    blockedId
  );
  await sql.transaction(async (tx) => {
    await deleteFriendship(tx, blockerId, blockedId, now);
    await cancelPendingRequestsBetween(tx, blockerId, blockedId, now);
    await insertBlock({ db: tx, blockerId, blockedId, now, createId });
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
