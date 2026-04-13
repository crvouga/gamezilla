import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { createLogger } from '@gamezilla/shared/logger';
import { Hono } from 'hono';
import type { ApiHandlerConfig } from './api-types';
import { UnauthorizedError } from './auth/unauthorized-error';
import { apiCors } from './middleware/api-cors';
import { createAuthClaimApp } from './routes/auth-claim';
import { createClientConfigApp } from './routes/client-config';
import { healthApp } from './routes/health';

const log = createLogger({ name: 'api:app' });

export type { ApiHandlerConfig } from './api-types';

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export function createApiApp(config: ApiHandlerConfig) {
  const { honoApp: patchDbApp, basePath } = createPatchDbApiHandler(config);
  /** RPC client keys use the literal mount path; wire URL stays `basePath`-driven. */
  const patchMount = basePath as '/patch-db';
  const db = config.db;
  const googleClientId = config.googleClientId;
  const authOpts =
    googleClientId !== undefined && googleClientId !== ''
      ? { googleClientId }
      : {};

  return new Hono()
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(config.googleClientId))
    .route('/', createAuthClaimApp(db, authOpts))
    .route(patchMount, patchDbApp)
    .onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: err.message }, 401);
      }
      const message = err instanceof Error ? err.message : String(err);
      log.error('handler error', { error: message });
      return c.json({ error: message }, 500);
    });
}
