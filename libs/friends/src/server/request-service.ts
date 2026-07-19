import type { SqlClient } from '@pkgs/sql-client/interface';

import { findPendingRequestBetween } from '../shared/friends-sql/friend-request-sql';
import {
  friendshipExists,
  isBlockedEitherDirection,
} from '../shared/friends-sql/friendship-block-sql';
import type { FriendshipStatus } from '../shared/friends-types';
import { backfillPendingFriendRequestInteractions } from './friends-inbox-publish';

export async function resolveFriendshipStatus(
  sql: SqlClient,
  viewerId: string,
  targetUserId: string
): Promise<FriendshipStatus> {
  if (viewerId === targetUserId) return 'none';
  const block = await isBlockedEitherDirection(sql, viewerId, targetUserId);
  if (block === 'by_a') return 'blocked_by_me';
  if (block === 'by_b') return 'blocked_by_them';
  if (await friendshipExists(sql, viewerId, targetUserId)) return 'friends';
  const outgoing = await findPendingRequestBetween(sql, viewerId, targetUserId);
  if (outgoing !== null) return 'pending_outgoing';
  const incoming = await findPendingRequestBetween(sql, targetUserId, viewerId);
  if (incoming !== null) return 'pending_incoming';
  return 'none';
}

export async function backfillFriendRequestInboxInteractions(
  sql: SqlClient,
  viewerId: string
): Promise<number> {
  return backfillPendingFriendRequestInteractions(sql, viewerId);
}
