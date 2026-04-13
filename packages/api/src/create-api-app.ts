import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { ValidationError } from '@gamezilla/shared/assert';
import { createLogger } from '@gamezilla/shared/logger';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiHandlerConfig } from './api-types';
import { UnauthorizedError } from './auth/unauthorized-error';
import { apiCors } from './middleware/api-cors';
import { createAuthClaimApp } from './routes/auth-claim';
import { createClientConfigApp } from './routes/client-config';
import { healthApp } from './routes/health';

const log = createLogger({ name: 'api:app' });

export type { ApiHandlerConfig } from './api-types';

function isAssertionCrash(value: unknown): value is { message: string; context?: Record<string, unknown> } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__assertion_failure' in value &&
    'message' in value
  );
}

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
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      if (err instanceof HTTPException) {
        return c.json({ error: err.message }, err.status);
      }
      if (isAssertionCrash(err as unknown)) {
        const crash = err as unknown as { message: string; context?: Record<string, unknown> };
        log.error('assertion failure', { error: crash.message, context: crash.context });
        return c.json({ error: 'Internal server error' }, 500);
      }
      const message = err instanceof Error ? err.message : 'Internal server error';
      log.error('handler error', { error: err instanceof Error ? err.message : String(err) });
      return c.json({ error: message }, 500);
    });
}
