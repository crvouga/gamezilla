import type { SqlTx } from '@pkgs/sql-client/interface';

import { FriendRequestRepository } from '../shared/friends-sql/friend-request-repository';
import { FriendshipRepository } from '../shared/friends-sql/friendship-repository';
import { UserBlockRepository } from '../shared/friends-sql/user-block-repository';
import type { FriendshipStatus } from '../shared/friends-types';
import type { FriendsInboxPublisher } from './friends-inbox-publisher';

export class FriendshipStatusService {
  constructor(
    private readonly tx: SqlTx,
    private readonly inboxPublisher: FriendsInboxPublisher
  ) {}

  async resolve(
    viewerId: string,
    targetUserId: string
  ): Promise<FriendshipStatus> {
    if (viewerId === targetUserId) return 'none';
    const blockRepo = new UserBlockRepository(this.tx);
    const friendshipRepo = new FriendshipRepository(this.tx);
    const requestRepo = new FriendRequestRepository(this.tx);
    const block = await blockRepo.isBlockedEitherDirection(
      viewerId,
      targetUserId
    );
    if (block === 'by_a') return 'blocked_by_me';
    if (block === 'by_b') return 'blocked_by_them';
    if (await friendshipRepo.exists(viewerId, targetUserId)) {
      return 'friends';
    }
    const outgoing = await requestRepo.findPendingBetween(
      viewerId,
      targetUserId
    );
    if (outgoing !== null) return 'pending_outgoing';
    const incoming = await requestRepo.findPendingBetween(
      targetUserId,
      viewerId
    );
    if (incoming !== null) return 'pending_incoming';
    return 'none';
  }

  async backfillFriendRequestInboxInteractions(
    viewerId: string
  ): Promise<number> {
    return this.inboxPublisher.backfillPendingIncoming(viewerId);
  }
}
