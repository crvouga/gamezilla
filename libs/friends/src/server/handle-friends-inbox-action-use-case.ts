import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  type FriendsInboxActionArgs,
  FriendsInboxActionHandler,
} from './friends-inbox-actions';
import { createFriendsInboxPublisher } from './friends-inbox-publisher';

export class HandleFriendsInboxActionUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io
  ) {}

  async execute(
    args: FriendsInboxActionArgs
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.db.transaction(async (tx) => {
      const inboxPublisher = createFriendsInboxPublisher(tx, this.io);
      const handler = new FriendsInboxActionHandler(
        tx,
        this.io,
        inboxPublisher
      );
      return handler.handle(args);
    });
  }
}
