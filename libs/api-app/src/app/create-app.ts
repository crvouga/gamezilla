// @io-wall-ok
import { createAuthApiRoutes } from '@libs/auth/server/auth-routes';
import type { AuthContext } from '@libs/auth/server/types';
import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { isLocalApiOrigin } from '@libs/auth/shared/local-api-origin';
import type { DesiredClientConfig } from '@libs/client-config/server/ensure-client-config-materialized';
import type { ObservabilityBackendName } from '@libs/client-config/shared/client-config-keys';
import { createFriendsApp } from '@libs/friends/server/friends-routes';
import { StripeApp } from '@libs/stripe/stripe-app';
import { assert, ForbiddenError, ValidationError } from '@pkgs/assert';
import { wallIo } from '@pkgs/io';
import { createLlmAppFromBindings } from '@pkgs/llm/server';
import { createLogger } from '@pkgs/logger';
import { createObservabilityMiddleware } from '@pkgs/observability/server/middleware';
import type { SecretStore } from '@pkgs/secret-store';
import { createTtsAppFromBindings } from '@pkgs/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { createBetterAuthRoutes } from '../auth/better-auth-routes';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { createInboxSubApp } from '../inbox/route';
import { createMatchmakingSubApp } from '../matchmaking/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createRoomApp } from '../room/route';
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
    fetch: appIo.http.fetch.bind(appIo.http),
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
    http: appIo.http,
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
  return new StripeApp(
    () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe: request store missing');
      return s.sqlClient;
    },
    stripe,
    async (_sql, req) => {
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
    }
  ).build();
}

const LOCAL_EMQX_WSS_URL = 'ws://127.0.0.1:8083/mqtt';

async function readOptionalSecretValue(
  secretStore: SecretStore,
  name: string
): Promise<string | null> {
  const raw = (await secretStore.getOptional(name))?.readSecretValue();
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseObservabilityBackend(
  raw: string | null
): ObservabilityBackendName {
  if (raw === null) return 'noop';
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'noop' ||
    normalized === 'sentry' ||
    normalized === 'console'
  ) {
    return normalized;
  }
  return 'noop';
}

async function resolveEmqxWssUrlForClientConfig(args: {
  readonly secretStore: SecretStore;
  readonly apiUrlOverride?: string | null;
}): Promise<string | null> {
  const apiUrl =
    args.apiUrlOverride?.trim() ||
    (await readOptionalSecretValue(args.secretStore, ApiSecretName.apiUrl)) ||
    '';
  if (apiUrl.length > 0 && isLocalApiOrigin(apiUrl)) {
    return LOCAL_EMQX_WSS_URL;
  }
  return readOptionalSecretValue(args.secretStore, ApiSecretName.emqxWssUrl);
}

async function buildDesiredClientConfig(args: {
  readonly secretStore: SecretStore;
  readonly betterAuth: ApiHandlerConfig['betterAuth'];
  readonly stripeConfigured: boolean;
  readonly ttsConfigured: boolean;
  readonly llmConfigured: boolean;
  readonly apiUrlOverride?: string | null;
}): Promise<DesiredClientConfig> {
  const { betterAuth, secretStore } = args;
  const [emqxWssUrl, sentryDsn, observabilityRaw] = await Promise.all([
    resolveEmqxWssUrlForClientConfig({
      secretStore,
      ...(args.apiUrlOverride !== undefined
        ? { apiUrlOverride: args.apiUrlOverride }
        : {}),
    }),
    readOptionalSecretValue(secretStore, ApiSecretName.expoPublicSentryDsn),
    readOptionalSecretValue(
      secretStore,
      ApiSecretName.expoPublicObservabilityBackend
    ),
  ]);
  return {
    google: betterAuth.googleEnabled,
    emailPassword: betterAuth.enableEmailPassword,
    stripe: args.stripeConfigured,
    tts: args.ttsConfigured,
    llm: args.llmConfigured,
    googleWebClientId: betterAuth.googleClientId,
    emqxWssUrl,
    sentryDsn,
    observabilityBackend: parseObservabilityBackend(observabilityRaw),
  };
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

  const desiredClientConfig = await buildDesiredClientConfig({
    secretStore,
    betterAuth,
    stripeConfigured: stripe !== null,
    ttsConfigured: tts.configured,
    llmConfigured: llm.configured,
    ...(config.apiUrlOverride !== undefined
      ? { apiUrlOverride: config.apiUrlOverride }
      : {}),
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
        io: appIo,
        desiredClientConfig,
      })
    )
    .use('*', apiCors)
    .route('/', healthApp)
    .route(
      '/',
      createBetterAuthRoutes({
        secretsEnv,
        webClientOrigin: betterAuth.webClientOrigin,
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
