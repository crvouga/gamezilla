import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { publishFriendEvent } from '../shared/friend-events';
import { FriendsError } from '../shared/friends-errors';
import { FriendRequestRepository } from '../shared/friends-sql/friend-request-repository';
import { FriendshipRepository } from '../shared/friends-sql/friendship-repository';
import { UserBlockRepository } from '../shared/friends-sql/user-block-repository';
import type { FriendsInboxPublisher } from './friends-inbox-publisher';

export class FriendBlockService {
  constructor(
    private readonly sql: SqlClient,
    private readonly createId: CreateId,
    private readonly inboxPublisher: FriendsInboxPublisher
  ) {}

  private assertNotSelf(actorId: string, targetId: string): void {
    if (actorId === targetId) {
      throw new FriendsError('FRIENDS_SELF', 'Cannot block yourself');
    }
  }

  async block(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    this.assertNotSelf(blockerId, blockedId);
    await this.inboxPublisher.deactivatePendingInteractionsBetween(
      blockerId,
      blockedId
    );
    await this.sql.transaction(async (tx) => {
      const friendshipRepo = new FriendshipRepository(tx);
      const requestRepo = new FriendRequestRepository(tx);
      const blockRepo = new UserBlockRepository(tx, this.createId);
      await friendshipRepo.delete(blockerId, blockedId, now);
      await requestRepo.cancelPendingBetween(blockerId, blockedId, now);
      await blockRepo.insertManaged(blockerId, blockedId, now);
    });
    publishFriendEvent({ type: 'friend.blocked', blockerId, blockedId });
  }

  async unblock(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    this.assertNotSelf(blockerId, blockedId);
    await new UserBlockRepository(this.sql, this.createId).delete(
      blockerId,
      blockedId,
      now
    );
  }
}
