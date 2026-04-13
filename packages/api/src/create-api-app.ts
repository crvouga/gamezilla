import { createLogger } from '@gamezilla/shared/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiHandlerConfig } from './api-types';
import { UnauthorizedError } from './auth/unauthorized-error';
import { registerAuthClaim } from './routes/auth-claim';
import { registerClientConfig } from './routes/client-config';
import { registerHealth } from './routes/health';
import { registerPatchDbRoutes } from './routes/patch-db';

const log = createLogger({ name: 'api:app' });

export type { ApiHandlerConfig } from './api-types';

export function createApiApp(config: ApiHandlerConfig): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Cache-Control',
        'Pragma',
        'Authorization',
      ],
    })
  );

  registerHealth(app);
  registerClientConfig(app, config.googleClientId);
  registerAuthClaim(app, config.db, config.googleClientId);
  registerPatchDbRoutes(app, config);

  app.onError((err, c) => {
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error('handler error', { error: message });
    return c.json({ error: message }, 500);
  });

  return app;
}
