import { createAuthApiRoutes } from '@libs/auth/server/auth-routes';
import type { AuthContext } from '@libs/auth/server/types';
import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { createClientConfigApp } from '@libs/client-config/server/route';
import { createFriendsApp } from '@libs/friends/server/friends-routes';
import { createStripeApp } from '@libs/stripe/stripe-app';
import { assert, ForbiddenError, ValidationError } from '@pkgs/assert';
import { createLlmAppFromBindings } from '@pkgs/llm/server';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { createObservabilityMiddleware } from '@pkgs/observability/server/middleware';
import { createTtsAppFromBindings } from '@pkgs/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { createBetterAuthRoutes } from '../auth/better-auth-routes';
import { ApiSecretName } from '../config/secret-names';
import { createApiFeatures } from '../features/api-features';
import { createFeaturesApp } from '../features/features-route';
import { healthApp } from '../health/route';
import { createInboxSubApp } from '../inbox/route';
import { createMatchmakingSubApp } from '../matchmaking/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createRoomApp } from '../room/route';
import { notifyClientConfigChannels } from '../sync/notify-client-config-channels';
import { notifyUserChannels } from '../sync/notify-user-channels';
import { createPubSubTokenRoutes } from '../sync/pubsub-token-routes';
import { createSyncApp } from '../sync/sync-app';
import type { ApiHonoEnv } from './api-hono-types';
import type { ApiHandlerConfig } from './config';
import { apiCors } from './cors';
import { createRequestDbMiddleware } from './request-db-middleware';

const appIo = wallIo();
const log = createLogger({ name: 'api:app', now: appIo.clock.now });

export type { ApiHandlerConfig } from './config';

function isAssertionFailure(err: unknown): err is {
  message: string;
  context?: Record<string, unknown>;
} {
  return (
    err !== null &&
    typeof err === 'object' &&
    '__assertion_failure' in err &&
    'message' in err
  );
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
    if (isAssertionFailure(err)) {
      log.error('assertion failure', {
        error: err.message,
        context: err.context,
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
): Promise<Stripe | null> {
  const raw = (
    await secretStore.getOptional(ApiSecretName.stripeSecretKey)
  )?.readSecretValue();
  const key =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  if (key === null) {
    log.warn('stripe secret key missing; Stripe routes will return 503');
    return null;
  }
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function createTtsAppForApi(config: ApiHandlerConfig) {
  const result = await createTtsAppFromBindings({
    secretStore: config.secretStore,
    objectStore: config.objectStore,
    publicPathPrefix: '/api',
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'tts auth: request store missing');
      await s.sessionAuth.resolveAuthContext(s.sqlClient, req);
    },
  });
  if (!result.configured) {
    log.warn('ELEVEN_LABS_API_KEY missing; TTS routes will return 503');
  }
  return result;
}

async function createLlmAppForApi(config: ApiHandlerConfig) {
  const result = await createLlmAppFromBindings({
    secretStore: config.secretStore,
    getKv: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'llm kv: request store missing');
      return s.kv;
    },
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'llm auth: request store missing');
      await s.sessionAuth.resolveAuthContext(s.sqlClient, req);
    },
  });
  if (!result.configured) {
    log.warn(
      'OPENAI_API_KEY / OPENAI_BASE_URL missing; LLM routes will return 503'
    );
  }
  return result;
}

function createStripeSubApp(stripe: Stripe | null) {
  return createStripeApp({
    getSqlClient: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe: request store missing');
      return s.sqlClient;
    },
    stripe,
    requireAuth: async (_sql, req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe auth: request store missing');
      const ctx = await s.sessionAuth.requireAuthContext(s.sqlClient, req);
      const auth = appAuth(ctx);
      if (auth === null || auth.accountId === null || auth.isAnon) {
        throw new UnauthorizedError(
          'Stripe routes require a signed-in account'
        );
      }
      return { accountId: auth.accountId, deviceId: auth.deviceId };
    },
  });
}

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export async function createApiApp(config: ApiHandlerConfig) {
  const { secretStore, dbScope, observability, betterAuth, secretsEnv } =
    config;
  const [stripe, tts, llm] = await Promise.all([
    createStripeClient(secretStore),
    createTtsAppForApi(config),
    createLlmAppForApi(config),
  ]);

  if (!betterAuth.googleEnabled) {
    log.warn(
      'Google OAuth credentials missing; Google sign-in disabled (email/password and anon still available when enabled)'
    );
  }

  const features = createApiFeatures({
    googleEnabled: betterAuth.googleEnabled,
    emailPasswordEnabled: betterAuth.enableEmailPassword,
    stripeConfigured: stripe !== null,
    ttsConfigured: tts.configured,
    llmConfigured: llm.configured,
  });

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
        betterAuth,
        apiUrlOverride: config.apiUrlOverride,
        databaseUrlOverride: config.databaseUrlOverride,
        secretsEnv,
        observability,
      })
    )
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createFeaturesApp(features))
    .route(
      '/',
      createBetterAuthRoutes({
        secretsEnv,
        webClientOrigin: betterAuth.webClientOrigin,
      })
    )
    .route(
      '/',
      createClientConfigApp(log, {
        onConfigUpdated: () =>
          notifyClientConfigChannels('client-config-refresh'),
        googleWebClientId: betterAuth.googleClientId,
      })
    )
    .route('/', createFriendsApp())
    .route(
      '/',
      createAuthApiRoutes({
        onUserDomainWrite: (userId) =>
          notifyUserChannels([userId], 'auth-domain-write'),
      })
    )
    .route('/', createSyncApp())
    .route('/', createPubSubTokenRoutes())
    .route('/', tts.app)
    .route('/', llm.app)
    .route('/', createStripeSubApp(stripe))
    .route('/', createRoomApp())
    .route('/matchmaking', createMatchmakingSubApp())
    .route('/inbox', createInboxSubApp());

  apiRouter.onError(createApiErrorHandler());

  return new Hono().route('/api', apiRouter);
}
