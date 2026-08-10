import type { Io } from '@pkgs/io';
import type { SqlTx } from '@pkgs/sql-client/interface';

import { publishFriendEvent } from '../shared/friend-events';
import { FriendsError } from '../shared/friends-errors';
import { FriendRequestRepository } from '../shared/friends-sql/friend-request-repository';
import { FriendshipRepository } from '../shared/friends-sql/friendship-repository';
import { UserBlockRepository } from '../shared/friends-sql/user-block-repository';
import type { FriendsInboxPublisher } from './friends-inbox-publisher';

/** Caller must supply a transaction-scoped {@link SqlTx}. */
export class FriendBlockService {
  constructor(
    private readonly tx: SqlTx,
    private readonly io: Io,
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
    const friendshipRepo = new FriendshipRepository(this.tx);
    const requestRepo = new FriendRequestRepository(this.tx);
    const blockRepo = new UserBlockRepository(this.tx);
    await friendshipRepo.delete(blockerId, blockedId, now);
    await requestRepo.cancelPendingBetween(blockerId, blockedId, now);
    await blockRepo.insertManaged(blockerId, blockedId, now, this.io.createId);
    publishFriendEvent({ type: 'friend.blocked', blockerId, blockedId });
  }

  async unblock(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    this.assertNotSelf(blockerId, blockedId);
    await new UserBlockRepository(this.tx).delete(blockerId, blockedId, now);
  }
}
