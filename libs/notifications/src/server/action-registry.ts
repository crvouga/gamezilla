import type { SqlTx } from '@pkgs/sql-client/interface';
import type { Notification } from '../shared/notification';
import { NotificationsError } from '../shared/notifications-errors';

export type NotificationActionContext = {
  readonly sql: SqlTx;
  readonly actorId: string;
  readonly interaction: Notification;
  readonly actionId: string;
};

export type NotificationActionHandler = (
  ctx: NotificationActionContext
) => Promise<void>;

const handlers = new Map<string, NotificationActionHandler>();

export function registerNotificationActionHandler(
  namespace: string,
  handler: NotificationActionHandler
): void {
  handlers.set(namespace, handler);
}

export function clearActionHandlersForTests(): void {
  handlers.clear();
}

export async function dispatchNotificationAction(
  ctx: NotificationActionContext
): Promise<void> {
  const handler = handlers.get(ctx.interaction.sourceNamespace);
  if (handler === undefined) {
    throw new NotificationsError(
      'NOTIFICATIONS_HANDLER_MISSING',
      `No action handler registered for ${ctx.interaction.sourceNamespace}`
    );
  }
  await handler(ctx);
}
