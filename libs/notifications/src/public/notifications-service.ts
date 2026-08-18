import type { Io } from '@pkgs/io';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { Notification } from '../shared/notifications/notification';
import {
  deactivateNotification,
  publishNotification,
} from '../use-cases/publish-notification/server/publish';
import type {
  DeactivateNotificationInput,
  PublishNotificationInput,
} from './types';

export type NotificationsCtx = {
  readonly tx: SqlTx;
  readonly io: Io;
};

/**
 * Transaction-scoped notifications writer. Construct inside outbox consumers /
 * use cases — never store on long-lived fields.
 */
export class Notifications {
  constructor(private readonly ctx: NotificationsCtx) {}

  async send(input: PublishNotificationInput): Promise<Notification> {
    return publishNotification(
      this.ctx.tx,
      input,
      this.ctx.io.clock.now,
      this.ctx.io.createId
    );
  }

  async deactivate(input: DeactivateNotificationInput): Promise<void> {
    await deactivateNotification(this.ctx.tx, input, this.ctx.io.clock.now);
  }
}
