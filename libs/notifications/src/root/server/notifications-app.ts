import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { createNotificationsApp } from './app';
import { migrateNotifications } from './migrate';
import type { NotificationsRequestContext } from './notifications-context';

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

export { migrateNotifications } from './migrate';
export type { NotificationsRequestContext } from './notifications-context';
export { NotificationsDatabaseMigration } from './notifications-database-migration';
