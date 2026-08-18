import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { createNotificationsApp } from './server/app';
import { migrateNotifications } from './server/migrate';
import type { NotificationsRequestContext } from './server/notifications-context';

export type NotificationsStorage = {
  readonly sqlClient: SqlClient;
};

export type NotificationsAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly requestContext: () => NotificationsRequestContext;
};

/** HTTP/sync shell for the notifications sub-app (migrate + Hono routes). */
export class NotificationsApp {
  private readonly storage: NotificationsStorage;
  private bootPromise: Promise<void> | null = null;

  constructor(storage: NotificationsStorage) {
    this.storage = storage;
  }

  ready(): Promise<void> {
    if (this.bootPromise === null) {
      this.bootPromise = migrateNotifications(this.storage.sqlClient);
    }
    return this.bootPromise;
  }

  app(opts: NotificationsAppOptions) {
    return createNotificationsApp({
      requireAuth: opts.requireAuth,
      requestContext: opts.requestContext,
    });
  }
}

export { registerNotificationActionHandler } from './server/action-registry';
export { migrateNotifications } from './server/migrate';
export type { NotificationsCtx } from './server/notifications';
export { Notifications } from './server/notifications';
export { NotificationsDatabaseMigration } from './server/notifications-database-migration';
export {
  deactivateNotification,
  publishNotification,
  updateNotification,
} from './server/publish';
export { NOTIFICATIONS_SERVER_MANAGED } from './shared/writes/row-bindings';
