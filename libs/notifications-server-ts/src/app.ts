import { NotificationsError } from '@libs/notifications-shared-ts/notifications-errors';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { Hono, type MiddlewareHandler } from 'hono';
import { registerInboxRoutes } from './notifications-app-routes';
import type { NotificationsRequestContext } from './notifications-context';

export type CreateNotificationsAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly requestContext: () => NotificationsRequestContext;
  readonly now: () => number;
};

function mapNotificationsError(error: unknown): {
  status: number;
  body: unknown;
} {
  if (error instanceof MutationError)
    return { status: 400, body: { error: error.message, code: error.code } };
  if (error instanceof NotificationsError) {
    switch (error.code) {
      case 'NOTIFICATIONS_NOT_FOUND':
        return {
          status: 404,
          body: { error: error.message, code: error.code },
        };
      case 'NOTIFICATIONS_FORBIDDEN':
        return {
          status: 403,
          body: { error: error.message, code: error.code },
        };
      case 'NOTIFICATIONS_HANDLER_MISSING':
      case 'NOTIFICATIONS_UNKNOWN_ACTION':
        return {
          status: 400,
          body: { error: error.message, code: error.code },
        };
      default:
        return {
          status: 400,
          body: { error: error.message, code: error.code },
        };
    }
  }
  return { status: 500, body: { error: 'internal' } };
}

export function createNotificationsApp(
  opts: CreateNotificationsAppOptions
): Hono {
  const { requireAuth, requestContext, now } = opts;
  const log = createLogger({ name: 'notifications-app', now });
  const app = new Hono();
  app.use('*', requireAuth);
  registerInboxRoutes(app, requestContext, now);

  app.onError((err, c) => {
    const mapped = mapNotificationsError(err);
    if (mapped.status >= 500) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('inbox app: internal error', {
        message,
        path: c.req.path,
        method: c.req.method,
      });
    }
    return c.json(mapped.body, mapped.status as 400 | 403 | 404 | 500);
  });

  return app;
}
