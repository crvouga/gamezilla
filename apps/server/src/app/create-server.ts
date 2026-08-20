import { appAuth } from '@libs/auth/public/auth-context';
import { isLocalApiOrigin } from '@libs/auth/public/local-api-origin';
import type { AuthContext } from '@libs/auth/public/types';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { AuthApiRoutes } from '@libs/auth/root/server/auth-routes';
import { BillingApp } from '@libs/billing/root/server/billing-app';
import type { ObservabilityBackendName } from '@libs/client-config/public/client-config-keys';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import { FriendsApp } from '@libs/friends/root/server/create-friends-app';
import { assert, ForbiddenError, ValidationError } from '@pkgs/assert';
import type { Billing } from '@pkgs/billing';
import { createLlmAppFromBindings } from '@pkgs/llm/server';
import { createLogger } from '@pkgs/logger';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import { createObservabilityMiddleware } from '@pkgs/observability/server/middleware';
import type { SecretStore } from '@pkgs/secret-store';
import { createSystemConsoleApp } from '@pkgs/system-console/server';
import { createTtsAppFromBindings } from '@pkgs/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createBetterAuthRoutes } from '../auth/better-auth-routes';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { createMatchmakingSubApp } from '../matchmaking/route';
import { createNotificationsSubApp } from '../notifications/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createRoomApp } from '../room/route';
import { setApiPubSubOverride } from '../sync/api-pubsub';
import { notifyUserChannels } from '../sync/notify-user-channels';
import { drainAndNotifyOutbox } from '../sync/outbox-drain';
import { createPubSubTokenRoutes } from '../sync/pubsub-token-routes';
import { createSyncApp } from '../sync/sync-app';
import type { ApiHonoEnv } from './api-hono-types';
import { apiCors } from './cors';
import { createRequestDbMiddleware } from './request-db-middleware';
import type { ServerEnv } from './server-env';

function createAppLogger(env: ServerEnv) {
  return createLogger({ name: 'server:app', now: env.clock.now });
}

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

function createApiErrorHandler(log: ReturnType<typeof createAppLogger>) {
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

async function createTtsAppForServer(env: ServerEnv) {
  const log = createAppLogger(env);
  const result = await createTtsAppFromBindings({
    secretStore: env.secrets,
    objectStore: env.blob,
    publicPathPrefix: '/api',
    fetch: env.fetch,
    requireAuth: async (req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'tts auth: request store missing');
      await s.sessionAuth.resolveAuthContext(s.sqlClient, req);
    },
    ...(env.tts !== null ? { provider: env.tts } : {}),
  });
  if (!result.configured) {
    log.warn('ELEVEN_LABS_API_KEY missing; TTS routes will return 503');
  }
  return result;
}

async function createLlmAppForServer(env: ServerEnv) {
  const log = createAppLogger(env);
  const result = await createLlmAppFromBindings({
    secretStore: env.secrets,
    http: { fetch: env.fetch },
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
    ...(env.llm !== null ? { provider: env.llm } : {}),
  });
  if (!result.configured) {
    log.warn(
      'OPENAI_API_KEY / OPENAI_BASE_URL missing; LLM routes will return 503'
    );
  }
  return result;
}

function createBillingSubApp(billing: Billing | null, now: () => number) {
  return new BillingApp(
    () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'billing: request store missing');
      return s.sqlClient;
    },
    billing,
    async (_sql, req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'billing auth: request store missing');
      const ctx = await s.sessionAuth.requireAuthContext(s.sqlClient, req);
      const auth = appAuth(ctx);
      if (auth === null || auth.accountId === null || auth.isAnon) {
        throw new UnauthorizedError(
          'Billing routes require a signed-in account'
        );
      }
      return { accountId: auth.accountId, deviceId: auth.deviceId };
    },
    now
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
  if (normalized === 'noop' || normalized === 'console') {
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
  readonly betterAuth: ServerEnv['betterAuth'];
  readonly billingConfigured: boolean;
  readonly ttsConfigured: boolean;
  readonly llmConfigured: boolean;
  readonly apiUrlOverride?: string | null;
}): Promise<DesiredClientConfig> {
  const { betterAuth, secretStore } = args;
  const [emqxWssUrl, observabilityRaw] = await Promise.all([
    resolveEmqxWssUrlForClientConfig({
      secretStore,
      ...(args.apiUrlOverride !== undefined
        ? { apiUrlOverride: args.apiUrlOverride }
        : {}),
    }),
    readOptionalSecretValue(
      secretStore,
      ApiSecretName.expoPublicObservabilityBackend
    ),
  ]);
  return {
    google: betterAuth.googleEnabled,
    emailPassword: betterAuth.enableEmailPassword,
    billing: args.billingConfigured,
    tts: args.ttsConfigured,
    llm: args.llmConfigured,
    googleWebClientId: betterAuth.googleClientId,
    emqxWssUrl,
    observabilityBackend: parseObservabilityBackend(observabilityRaw),
  };
}

function createServerRouter(args: {
  readonly env: ServerEnv;
  readonly desiredClientConfig: DesiredClientConfig;
  readonly billing: Billing | null;
  readonly tts: Awaited<ReturnType<typeof createTtsAppForServer>>;
  readonly llm: Awaited<ReturnType<typeof createLlmAppForServer>>;
  readonly log: ReturnType<typeof createAppLogger>;
}) {
  const { env, desiredClientConfig, billing, tts, llm, log } = args;
  const { secrets, observability, betterAuth, secretsEnv } = env;

  const apiRouter = new Hono<ApiHonoEnv<AuthContext>>()
    .use(
      '*',
      createObservabilityMiddleware(observability, {
        match: (path) => path.startsWith('/api/'),
      })
    )
    .use(
      '*',
      createRequestDbMiddleware(secrets, {
        betterAuth,
        apiUrlOverride: env.serverUrl,
        secretsEnv,
        observability,
        clock: env.clock,
        timers: env.timers,
        createId: env.createId,
        desiredClientConfig,
        openSqlClient: env.openSqlClient,
        ...(env.skipDatabaseUrlPolicy ? { skipDatabaseUrlPolicy: true } : {}),
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
    .route('/', new FriendsApp(env.clock).build())
    .route(
      '/',
      new AuthApiRoutes(env.clock, env.createId, (userId) =>
        notifyUserChannels([userId], 'auth-domain-write')
      ).build()
    )
    .use('*', async (c, next) => {
      await next();
      const path = new URL(c.req.url).pathname;
      if (c.req.method !== 'POST' || !path.endsWith('/mutations')) return;
      if (c.res.status < 200 || c.res.status >= 300) return;
      const store = apiRequestAsyncLocalStorage.getStore();
      if (store === undefined) return;
      await drainAndNotifyOutbox({
        db: store.sqlClient,
        clock: store.clock,
        createId: store.createId,
      });
    })
    .route(
      '/',
      createSyncApp({ now: () => env.clock.now(), createId: env.createId })
    )
    .route('/', createPubSubTokenRoutes())
    .route('/', tts.app)
    .route('/', llm.app)
    .route(
      '/',
      createBillingSubApp(billing, () => env.clock.now())
    )
    .route('/', createRoomApp())
    .route('/matchmaking', createMatchmakingSubApp())
    .route(
      '/notifications',
      createNotificationsSubApp(() => env.clock.now())
    );

  apiRouter.onError(createApiErrorHandler(log));
  return apiRouter;
}

async function createConsoleRouter(env: ServerEnv) {
  const reportConsole = createSystemConsoleApp({
    buckets: [
      {
        id: 'local',
        label: 'Local',
        store: await Promise.resolve(
          env.blob.withPrefix(ObjectStorePrefix.systemConsole)
        ),
      },
    ],
    timers: env.timers,
    now: () => env.clock.now(),
  });
  return new Hono().use('*', apiCors).route('/', reportConsole.app);
}

/**
 * Composes the server Worker app from mounted sub-apps (`app.route()`).
 */
export async function createServer(env: ServerEnv) {
  const { betterAuth } = env;
  const log = createAppLogger(env);

  if (env.events !== null) {
    setApiPubSubOverride(env.events);
  }

  const billing = env.billing;
  const [tts, llm] = await Promise.all([
    createTtsAppForServer(env),
    createLlmAppForServer(env),
  ]);

  if (!betterAuth.googleEnabled) {
    log.warn(
      'Google OAuth credentials missing; Google sign-in disabled (email/password and anon still available when enabled)'
    );
  }

  const desiredClientConfig = await buildDesiredClientConfig({
    secretStore: env.secrets,
    betterAuth,
    billingConfigured: billing !== null,
    ttsConfigured: tts.configured,
    llmConfigured: llm.configured,
    ...(env.serverUrl !== null ? { apiUrlOverride: env.serverUrl } : {}),
  });

  const consoleRouter = await createConsoleRouter(env);

  return new Hono()
    .route(
      '/api',
      createServerRouter({ env, desiredClientConfig, billing, tts, llm, log })
    )
    .route('/system-console', consoleRouter);
}
