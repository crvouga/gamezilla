import type { Notification } from '@libs/notifications-shared/notification';
import type {
  DeactivateNotificationInput,
  PublishNotificationInput,
} from '@libs/notifications-shared/publish-types';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { deactivateNotification, publishNotification } from './publish';

export type NotificationsCtx = {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly createId: CreateId;
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
      this.ctx.clock.now,
      this.ctx.createId
    );
  }

  async deactivate(input: DeactivateNotificationInput): Promise<void> {
    await deactivateNotification(this.ctx.tx, input, this.ctx.clock.now);
  }
}
