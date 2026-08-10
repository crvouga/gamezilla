import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { createFriendsInboxPublisher } from './friends-inbox-publisher';
import { FriendshipStatusService } from './friendship-status-service';

export class BackfillFriendRequestInboxUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io
  ) {}

  async execute(viewerId: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const inboxPublisher = createFriendsInboxPublisher(tx, this.io);
      const statusService = new FriendshipStatusService(tx, inboxPublisher);
      return statusService.backfillFriendRequestInboxInteractions(viewerId);
    });
  }
}
