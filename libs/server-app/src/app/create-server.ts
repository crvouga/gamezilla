import { isLocalApiOrigin } from '@libs/auth/public/local-api-origin';
import type { AuthContext } from '@libs/auth/public/types';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { AuthApiRoutes } from '@libs/auth/root/server/auth-routes';
import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/client-config/public/client-config-defaults';
import type { ObservabilityBackendName } from '@libs/client-config/public/client-config-keys';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import type { ComposedFeatureServers } from '@libs/feature/public/compose-server';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/public/permission-policy';
import { PubsubSecretName } from '@libs/pubsub/public/secret-names';
import { setHttpPubSubOverride } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { assert, ForbiddenError, ValidationError } from '@pkgs/assert';
import type { AuthProvider } from '@pkgs/auth/server';
import { createLlmAppFromBindings } from '@pkgs/llm-openai';
import { createLogger } from '@pkgs/logger';
import { createObservabilityMiddleware } from '@pkgs/observability/server/middleware';
import type { SecretStore } from '@pkgs/secret-store';
import { createTtsAppFromBindings } from '@pkgs/tts-elevenlabs';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { API_PATH_PREFIX, createAuthProvider } from '../config/auth-provider';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { createMatchmakingSubApp } from '../matchmaking/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { createRoomApp } from '../room/route';
import { notifyUserChannels } from '../sync/notify-user-channels';
import {
  drainAndNotifyOutbox,
  setOutboxConsumerRegistry,
} from '../sync/outbox-drain';
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
  const configured = await readOptionalSecretValue(
    args.secretStore,
    PubsubSecretName.wssUrl
  );
  if (configured !== null) return configured;
  if (apiUrl.length > 0 && isLocalApiOrigin(apiUrl)) {
    return LOCAL_EMQX_WSS_URL;
  }
  return null;
}

async function buildDesiredClientConfig(args: {
  readonly secretStore: SecretStore;
  readonly auth: AuthProvider;
  readonly billingConfigured: boolean;
  readonly ttsConfigured: boolean;
  readonly llmConfigured: boolean;
  readonly apiUrlOverride?: string | null;
}): Promise<DesiredClientConfig> {
  const { auth, secretStore } = args;
  const [emqxWssUrl, observabilityRaw] = await Promise.all([
    resolveEmqxWssUrlForClientConfig({
      secretStore,
      ...(args.apiUrlOverride !== undefined
        ? { apiUrlOverride: args.apiUrlOverride }
        : {}),
    }),
    readOptionalSecretValue(
      secretStore,
      ApiSecretName.viteObservabilityBackend
    ),
  ]);
  return {
    google: auth.signInMethods.includes('google'),
    apple: auth.signInMethods.includes('apple'),
    billing: args.billingConfigured,
    tts: args.ttsConfigured,
    llm: args.llmConfigured,
    googleWebClientId: null,
    emqxWssUrl,
    observabilityBackend: parseObservabilityBackend(observabilityRaw),
    permissionPolicy: DEFAULT_PERMISSION_POLICY,
    billingGracePeriodMs: DEFAULT_BILLING_GRACE_PERIOD_MS,
  };
}

function createSyncAppMount(env: ServerEnv, app: ComposedFeatures) {
  return createSyncApp({
    app,
    now: () => env.clock.now(),
    createId: env.createId,
    ...(env.secretsEnv === 'dev' ? { strictQueryLimits: true } : {}),
  });
}

/**
 * Endpoints the auth service answers on the API's own origin (a self-hosted
 * IdP), handed the raw request. A hosted service has none.
 */
function mountAuthHandler(
  shell: Hono<ApiHonoEnv<AuthContext>>,
  auth: AuthProvider
): void {
  const handler = auth.handler;
  if (handler === undefined) return;
  shell.all(`${handler.pathPrefix}/*`, (c) => handler.fetch(c.req.raw));
}

function createServerRouter(args: {
  readonly env: ServerEnv;
  readonly auth: AuthProvider;
  readonly desiredClientConfig: DesiredClientConfig;
  readonly servers: ComposedFeatureServers;
  readonly tts: Awaited<ReturnType<typeof createTtsAppForServer>>;
  readonly llm: Awaited<ReturnType<typeof createLlmAppForServer>>;
  readonly sync: Awaited<ReturnType<typeof createSyncApp>>;
  readonly log: ReturnType<typeof createAppLogger>;
}) {
  const { env, auth, desiredClientConfig, servers, tts, llm, sync, log } = args;
  const { secrets, observability, secretsEnv } = env;

  const shell = new Hono<ApiHonoEnv<AuthContext>>()
    .use(
      '*',
      createObservabilityMiddleware(observability, {
        match: (path) => path.startsWith('/api/'),
      })
    )
    .use(
      '*',
      createRequestDbMiddleware(secrets, {
        authServer: auth.server,
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
    .route('/', healthApp);
  mountAuthHandler(shell, auth);
  shell
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
    .route('/', sync)
    .route('/', createPubSubTokenRoutes(servers))
    .route('/', tts.app)
    .route('/', llm.app)
    .route('/', createRoomApp())
    .route('/matchmaking', createMatchmakingSubApp());

  // Whatever the composed features contribute, in feature order. The shell
  // mounts them; it does not know what any of them serves.
  const featureRouters = servers.routers({
    getSqlClient: () => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'feature routes: request store missing');
      return store.sqlClient;
    },
    clock: env.clock,
    createId: env.createId,
  });
  for (const router of featureRouters) shell.route('/', router);
  return shell.onError(createApiErrorHandler(log));
}

export type CreateServerArgs = {
  /** The folded feature set sync serves: schema, queries, topics, mutations. */
  readonly app: ComposedFeatures;
  /** The same features' server halves: routes, outbox consumers, topics. */
  readonly servers: ComposedFeatureServers;
};

/**
 * Composes the server app from mounted sub-apps (`app.route()`).
 *
 * The shell owns the platform routes — health, auth, sync, pubsub tokens,
 * rooms, matchmaking, the vendor apps — and mounts whatever the composed
 * features contribute on top. It names no feature, so the same function
 * serves the whole product and a single bounded context under test.
 */
export async function createServer(env: ServerEnv, args: CreateServerArgs) {
  const log = createAppLogger(env);
  setOutboxConsumerRegistry(args.servers.outboxConsumers);

  if (env.events !== null) {
    setHttpPubSubOverride(env.events);
  }

  const billing = env.billing;
  const [auth, tts, llm, sync] = await Promise.all([
    createAuthProvider({
      module: env.auth,
      secretStore: env.secrets,
      apiUrlOverride: env.serverUrl,
      secretsEnv: env.secretsEnv,
      clock: env.clock,
      createId: env.createId,
      http: { fetch: env.fetch },
    }),
    createTtsAppForServer(env),
    createLlmAppForServer(env),
    createSyncAppMount(env, args.app),
  ]);

  const desiredClientConfig = await buildDesiredClientConfig({
    secretStore: env.secrets,
    auth,
    billingConfigured: billing !== null,
    ttsConfigured: tts.configured,
    llmConfigured: llm.configured,
    ...(env.serverUrl !== null ? { apiUrlOverride: env.serverUrl } : {}),
  });

  return new Hono().route(
    API_PATH_PREFIX,
    createServerRouter({
      env,
      auth,
      desiredClientConfig,
      servers: args.servers,
      tts,
      llm,
      sync,
      log,
    })
  );
}
