import type { SqlClient } from '@pkgs/sql-client/interface';

import { FriendRequestRepository } from '../shared/friends-sql/friend-request-repository';
import { FriendshipRepository } from '../shared/friends-sql/friendship-repository';
import { UserBlockRepository } from '../shared/friends-sql/user-block-repository';
import type { FriendshipStatus } from '../shared/friends-types';
import type { FriendsInboxPublisher } from './friends-inbox-publisher';

export class FriendshipStatusService {
  private readonly requestRepo: FriendRequestRepository;
  private readonly friendshipRepo: FriendshipRepository;
  private readonly blockRepo: UserBlockRepository;

  constructor(
    sql: SqlClient,
    private readonly inboxPublisher: FriendsInboxPublisher
  ) {
    this.requestRepo = new FriendRequestRepository(sql);
    this.friendshipRepo = new FriendshipRepository(sql);
    this.blockRepo = new UserBlockRepository(sql);
  }

  async resolve(
    viewerId: string,
    targetUserId: string
  ): Promise<FriendshipStatus> {
    if (viewerId === targetUserId) return 'none';
    const block = await this.blockRepo.isBlockedEitherDirection(
      viewerId,
      targetUserId
    );
    if (block === 'by_a') return 'blocked_by_me';
    if (block === 'by_b') return 'blocked_by_them';
    if (await this.friendshipRepo.exists(viewerId, targetUserId)) {
      return 'friends';
    }
    const outgoing = await this.requestRepo.findPendingBetween(
      viewerId,
      targetUserId
    );
    if (outgoing !== null) return 'pending_outgoing';
    const incoming = await this.requestRepo.findPendingBetween(
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
