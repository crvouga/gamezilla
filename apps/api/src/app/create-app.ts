import { ValidationError } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';
import type { PatchDbContext } from '@gamezilla/patch-db/interface';
import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import { createStripeApp } from '@gamezilla/stripe/stripe-app';
import { makeStripeClient } from '@gamezilla/stripe/make-stripe-client';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createAuthApiRoutes } from '../auth/auth-routes';
import {
  createHttpBearerAuthPorts,
  createSessionAuth,
  mountHostedAuthHandler,
} from '../auth';
import { UnauthorizedError } from '../auth/unauthorized-error';
import { createClientConfigApp } from '../client-config/route';
import type { ApiWorkerEnv } from '../config/env';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { createSpaceApp } from '../spaces/route';
import type { ApiHandlerConfig } from './config';
import { apiCors } from './cors';

const log = createLogger({ name: 'api:app' });

export type { ApiHandlerConfig } from './config';

function isAssertionCrash(
  value: unknown
): value is { message: string; context?: Record<string, unknown> } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__assertion_failure' in value &&
    'message' in value
  );
}

function toPatchDbApiConfig(
  config: ApiHandlerConfig,
  resolvePatchDbContext: (req: Request) => Promise<PatchDbContext>
): PatchDbApiConfig {
  const { db, pubSub, basePath, instrumentation } = config;
  const patchDbConfig: PatchDbApiConfig = {
    db,
    pubSub,
    patchDbHttpAuth: {
      resolvePatchDbContext: (req) => resolvePatchDbContext(req),
    },
  };
  if (basePath !== undefined) {
    patchDbConfig.basePath = basePath;
  }
  if (instrumentation !== undefined) {
    patchDbConfig.instrumentation = instrumentation;
  }
  return patchDbConfig;
}

function createApiErrorHandler() {
  return (
    err: unknown,
    c: { json: (body: { error: string }, status: number) => Response }
  ) => {
    if (err instanceof ForbiddenError) {
      return c.json({ error: err.message }, 403);
    }
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
      const crash = err as unknown as {
        message: string;
        context?: Record<string, unknown>;
      };
      log.error('assertion failure', {
        error: crash.message,
        context: crash.context,
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    log.error('handler error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: message }, 500);
  };
}

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export async function createApiApp(config: ApiHandlerConfig) {
  const { secretStore, db } = config;

  const bearerAuth = await createHttpBearerAuthPorts(secretStore);
  const sessionAuth = createSessionAuth(bearerAuth);

  const stripeRaw = await secretStore.getOptional(
    ApiSecretName.stripeSecretKey
  );
  const stripeKey =
    typeof stripeRaw === 'string' && stripeRaw.trim().length > 0
      ? stripeRaw.trim()
      : null;
  const stripe = stripeKey !== null ? makeStripeClient(stripeKey) : null;

  const { honoApp: patchDbApp, basePath: resolvedBase } =
    createPatchDbApiHandler(
      toPatchDbApiConfig(config, (req) =>
        sessionAuth.resolvePatchDbContext(db, req)
      )
    );
  /** RPC client keys use the literal mount path; wire URL stays `basePath`-driven. */
  const patchMount = resolvedBase as '/patch-db';

  const app = new Hono<{ Bindings: ApiWorkerEnv }>()
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(db, log, secretStore))
    .route('/', createAuthApiRoutes(db, sessionAuth))
    .route(
      '/',
      createStripeApp({
        db,
        secretStore,
        stripe,
        requireAuth: (d, req) => sessionAuth.requireAuthContext(d, req),
        webhookSecretDopplerKey: ApiSecretName.stripeWebhookSecret,
      })
    )
    .route('/', createSpaceApp({ db, bearerAuth }))
    .route(patchMount, patchDbApp)
    .onError(createApiErrorHandler());

  await mountHostedAuthHandler(app, secretStore);
  return app;
}
