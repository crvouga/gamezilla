import { createLogger } from '@pkgs/logger';
import { Hono, type MiddlewareHandler } from 'hono';

import { InboxError } from '../shared/inbox-errors';
import { registerInboxRoutes } from './inbox-app-routes';
import type { InboxRequestContext } from './inbox-context';

export type CreateInboxAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly requestContext: () => InboxRequestContext;
};

const log = createLogger({ name: 'inbox-app' });

function mapInboxError(error: unknown): { status: number; body: unknown } {
  if (error instanceof InboxError) {
    switch (error.code) {
      case 'INBOX_NOT_FOUND':
        return {
          status: 404,
          body: { error: error.message, code: error.code },
        };
      case 'INBOX_FORBIDDEN':
        return {
          status: 403,
          body: { error: error.message, code: error.code },
        };
      case 'INBOX_HANDLER_MISSING':
      case 'INBOX_UNKNOWN_ACTION':
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

export function createInboxApp(opts: CreateInboxAppOptions): Hono {
  const { requireAuth, requestContext } = opts;
  const app = new Hono();
  app.use('*', requireAuth);
  registerInboxRoutes(app, requestContext);

  app.onError((err, c) => {
    const mapped = mapInboxError(err);
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
