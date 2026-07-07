import { createAuthApiRoutes } from '@libs/auth/server/auth-routes';
import type { AuthContext } from '@libs/auth/server/types';
import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { createClientConfigApp } from '@libs/client-config/server/route';
import { assert, ValidationError } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { createObservabilityMiddleware } from '@pkgs/observability/server/middleware';
import { isObservabilityActive } from '@pkgs/observability/port/is-observability-active';
import { wrapPatchDbSyncHostForObservability } from '@pkgs/patch-db/observability';
import { createLlmAppFromBindings } from '@pkgs/llm/server';
import { createMatchmakingSubApp } from '../matchmaking/route';
import type { PatchDbApiConfig } from '@pkgs/patch-db/api';
import { createPatchDbApiHandler } from '@pkgs/patch-db/api';
import { ForbiddenError } from '@pkgs/patch-db/forbidden-error';
import { createStripeApp } from '@libs/stripe/stripe-app';
import { createTtsAppFromBindings } from '@pkgs/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createRoomApp } from '../room/route';
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
  const { pubSub, basePath, instrumentation, observability } = config;
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
  if (isObservabilityActive(observability)) {
    patchDbConfig.syncHostWrapper = (host) =>
      wrapPatchDbSyncHostForObservability(observability, host);
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
  const raw = (
    await secretStore.getOptional(ApiSecretName.stripeSecretKey)
  )?.readSecretValue();
  const key =
    typeof raw === 'string' && raw.trim().length > 0
      ? raw.trim()
      : assert.fail('stripe secret key is required');
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function createTtsAppForApi(config: ApiHandlerConfig) {
  return await createTtsAppFromBindings({
    secretStore: config.secretStore,
    objectStore: config.objectStore,
    publicPathPrefix: '/api',
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'tts auth: request store missing');
      await s.sessionAuth.resolvePatchDbContext(s.patchDb, req);
    },
  });
}

async function createLlmAppForApi(config: ApiHandlerConfig) {
  return await createLlmAppFromBindings({
    secretStore: config.secretStore,
    getKv: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'llm kv: request store missing');
      return s.kv;
    },
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'llm auth: request store missing');
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
    webhookSecretKey: ApiSecretName.stripeWebhookSecret,
  });
}

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export async function createApiApp(config: ApiHandlerConfig) {
  const { secretStore, dbScope, observability, authServer, secretsEnv } =
    config;
  const [stripe, ttsApp, llmApp] = await Promise.all([
    createStripeClient(secretStore),
    createTtsAppForApi(config),
    createLlmAppForApi(config),
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

  const apiRouter = new Hono<ApiHonoEnv<AuthContext>>()
    .use(
      '*',
      createObservabilityMiddleware(observability, {
        match: (path) => path.startsWith('/api/'),
      })
    )
    .use(
      '*',
      createRequestDbMiddleware(secretStore, dbScope, {
        authServer,
        apiUrlOverride: config.apiUrlOverride,
        databaseUrlOverride: config.databaseUrlOverride,
        secretsEnv,
        observability,
      })
    )
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(log))
    .route('/', createAuthApiRoutes())
    .route('/', ttsApp)
    .route('/', llmApp)
    .route('/', createStripeSubApp(config, stripe))
    .route('/', createRoomApp())
    .route('/matchmaking', createMatchmakingSubApp())
    .route(patchMount, patchDbApp);

  apiRouter.onError(createApiErrorHandler());

  return new Hono().route('/api', apiRouter);
}
