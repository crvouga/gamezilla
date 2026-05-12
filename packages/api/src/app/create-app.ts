import { mountHostedAuthHandler } from '@gamezilla/auth/server';
import { createAuthApiRoutes } from '@gamezilla/auth/server/auth-routes';
import type { AuthContext } from '@gamezilla/auth/server/types';
import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { appAuth } from '@gamezilla/auth/shared/auth-context';
import { createClientConfigApp } from '@gamezilla/client-config/server/route';
import { assert, ValidationError } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';
import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import { createSpaceApp } from '@gamezilla/spaces/server/route';
import { createStripeApp } from '@gamezilla/stripe/stripe-app';
import { createTtsAppFromBindings } from '@gamezilla/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
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
  resolvePatchDbContext: (
    req: Request
  ) => Promise<Readonly<Record<string, unknown>>>
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

async function createStripeClient(
  secretStore: ApiHandlerConfig['secretStore']
): Promise<Stripe> {
  const raw = await secretStore.getOptional(ApiSecretName.stripeSecretKey);
  const key =
    typeof raw === 'string' && raw.trim().length > 0
      ? raw.trim()
      : assert.fail('stripe secret key is required');
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function createTtsApp(config: ApiHandlerConfig) {
  return await createTtsAppFromBindings({
    secretStore: config.secretStore,
    r2Bucket: config.ttsAudioBucket,
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'tts auth: request store missing');
      await s.sessionAuth.resolvePatchDbContext(s.patchDb, req);
    },
  });
}

function createStripeSubApp(config: ApiHandlerConfig, stripe: Stripe) {
  return createStripeApp({
    getPatchDb: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe: request store missing');
      return s.patchDb;
    },
    secretStore: config.secretStore,
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
  });
}

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export async function createApiApp(config: ApiHandlerConfig) {
  const { secretStore } = config;
  const [stripe, ttsApp] = await Promise.all([
    createStripeClient(secretStore),
    createTtsApp(config),
  ]);

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

  const baseApp = new Hono<ApiHonoEnv<AuthContext>>()
    .use('*', createRequestDbMiddleware(secretStore))
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(log, secretStore))
    .route('/', createAuthApiRoutes());

  const app = baseApp
    .route('/', ttsApp)
    .route('/', createStripeSubApp(config, stripe))
    .route('/', createSpaceApp())
    .route(patchMount, patchDbApp)
    .onError(createApiErrorHandler());

  await mountHostedAuthHandler(app, secretStore);
  return app;
}
