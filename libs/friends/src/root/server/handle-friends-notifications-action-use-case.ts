import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  type FriendsNotificationsActionArgs,
  FriendsNotificationsActionHandler,
} from './friends-notifications-actions';

export class HandleFriendsNotificationsActionUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io
  ) {}

  async execute(
    args: FriendsNotificationsActionArgs
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.db.transaction(async (tx) => {
      const handler = new FriendsNotificationsActionHandler(tx, this.io);
      return handler.handle(args);
    });
  }
}
