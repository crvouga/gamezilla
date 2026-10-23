import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';

import type { FriendsNotificationsActionArgs } from './friends-notifications-actions';
import { FriendsNotificationsActionHandler } from './friends-notifications-actions';

export class HandleFriendsNotificationsActionUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  async execute(
    args: FriendsNotificationsActionArgs
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.db.transaction(async (tx) => {
      const handler = new FriendsNotificationsActionHandler(tx, this.time);
      return handler.handle(args);
    });
  }
}
