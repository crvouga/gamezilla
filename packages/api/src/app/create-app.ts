import { assert, ValidationError } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';
import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import { makeStripeClient } from '@gamezilla/stripe/make-stripe-client';
import { createStripeApp } from '@gamezilla/stripe/stripe-app';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { mountHostedAuthHandler } from '@gamezilla/auth/server';
import { createAuthApiRoutes } from '@gamezilla/auth/server/auth-routes';
import { appAuth } from '@gamezilla/auth/shared/auth-context';
import type { AuthContext } from '@gamezilla/auth/server/types';
import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { createClientConfigApp } from '@gamezilla/client-config/server/route';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createSpaceApp } from '@gamezilla/spaces/server/route';
import type { ApiHonoEnv } from './api-hono-types';
import type { ApiHandlerConfig } from './config';
import { apiCors } from './cors';
import { createRequestDbMiddleware } from './request-db-middleware';

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
  resolvePatchDbContext: (req: Request) => Promise<Readonly<Record<string, unknown>>>
): PatchDbApiConfig {
  const { pubSub, basePath, instrumentation } = config;
  const patchDbConfig: PatchDbApiConfig = {
    db: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(
        s,
        'patch-db host resolver: apiRequestAsyncLocalStorage store missing'
      );
      return s.patchDb;
    },
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
  const { secretStore } = config;

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
      toPatchDbApiConfig(config, (req) => {
        const s = apiRequestAsyncLocalStorage.getStore();
        assert.defined(
          s,
          'resolvePatchDbContext: apiRequestAsyncLocalStorage store missing'
        );
        return s.sessionAuth.resolvePatchDbContext(s.patchDb, req);
      })
    );
  /** RPC client keys use the literal mount path; wire URL stays `basePath`-driven. */
  const patchMount = resolvedBase as '/patch-db';

  const app = new Hono<ApiHonoEnv<AuthContext>>()
    .use('*', createRequestDbMiddleware(secretStore))
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(log, secretStore))
    .route('/', createAuthApiRoutes())
    .route(
      '/',
      createStripeApp({
        getPatchDb: () => {
          const s = apiRequestAsyncLocalStorage.getStore();
          assert.defined(s, 'stripe: request store missing');
          return s.patchDb;
        },
        secretStore,
        stripe,
        requireAuth: async (d, req) => {
          const s = apiRequestAsyncLocalStorage.getStore();
          assert.defined(s, 'stripe auth: request store missing');
          const ctx = await s.sessionAuth.requireAuthContext(d, req);
          const auth = appAuth(ctx);
          if (auth === null || auth.accountId === null) {
            throw new UnauthorizedError(
              'Stripe routes require a signed-in account'
            );
          }
          return { accountId: auth.accountId, deviceId: auth.deviceId };
        },
        webhookSecretDopplerKey: ApiSecretName.stripeWebhookSecret,
      })
    )
    .route('/', createSpaceApp())
    .route(patchMount, patchDbApp)
    .onError(createApiErrorHandler());

  await mountHostedAuthHandler(app, secretStore);
  return app;
}
