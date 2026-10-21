import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  DeactivateNotificationInput,
  PublishNotificationInput,
} from '@libs/notifications-shared-ts/publish-types';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
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
