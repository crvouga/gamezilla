import type { MiddlewareHandler } from 'hono';

import { createNotificationsApp } from './app';
import type { NotificationsRequestContext } from './notifications-context';

export type NotificationsAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly requestContext: () => NotificationsRequestContext;
};

/**
 * HTTP/sync shell for the notifications sub-app.
 * Domain DDL is owned by defineTable → appSchema migrate (not a boot-time hand path).
 */
export class NotificationsApp {
  /** Schema is applied by Postgres/SQLite domain migrate; no lazy DDL. */
  ready(): Promise<void> {
    return Promise.resolve();
  }

  app(opts: NotificationsAppOptions) {
    return createNotificationsApp({
      requireAuth: opts.requireAuth,
      requestContext: opts.requestContext,
    });
  }
}

export type { NotificationsRequestContext } from './notifications-context';
