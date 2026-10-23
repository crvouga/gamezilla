import type { DesiredClientConfig } from '@libs/app-config-server-ts/ensure-client-config-materialized';
import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/app-config-shared-ts/client-config-defaults';
import {
  API_PATH_PREFIX,
  createAuthProvider,
} from '@libs/app-root-shared-ts/auth-provider';
import { apiCors } from '@libs/app-root-shared-ts/cors';
import {
  apiRequestAsyncLocalStorage,
  requireRequestStore,
} from '@libs/app-root-shared-ts/request-scope';
import { ApiSecretName } from '@libs/app-root-shared-ts/secret-names';
import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { AuthApiRoutes } from '@libs/auth-server-ts/auth-routes';
import { ChangedAuthUserResync } from '@libs/auth-server-ts/changed-auth-user-resync';
import { registerAccountDeletionConsumers } from '@libs/auth-shared-ts/account-deletion-consumers';
import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import { isLocalApiOrigin } from '@libs/auth-shared-ts/local-api-origin';
import type { AuthContext } from '@libs/auth-shared-ts/types';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared-ts/permission-policy';
import { withSyntheticPopulationOperators } from '@libs/permissions-shared-ts/synthetic-population-permission-policy';
import { setHttpPubSubOverride } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { PubsubSecretName } from '@libs/pubsub-shared-ts/secret-names';
import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import type { ComposedSubServers } from '@libs/sub-shared-ts/compose-server';
import { SpanStatusCode } from '@opentelemetry/api';
import { ForbiddenError } from '@pkgs/assert-root-shared-ts/forbidden-error';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { ValidationError } from '@pkgs/assert-root-shared-ts/validation-error';
import type { AuthProvider } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { createLlmAppFromBindings } from '@pkgs/llm-openai-server-ts/create-llm-app-from-bindings';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { currentCorrelation } from '@pkgs/observability-root-shared-ts/correlation';
import { activeSpan } from '@pkgs/observability-root-shared-ts/span';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';
import { createTtsAppFromBindings } from '@pkgs/tts-elevenlabs-server-ts/create-tts-app-from-bindings';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { mountBrowserTelemetryIngress } from './browser-telemetry-ingress';
import { createHealthApp } from './health-route';
import { drainCommittedMutationOutbox } from './mutation-outbox';
import { notifyUserChannels } from './notify-user-channels';
import {
  requestOutboxRegistry,
  setOutboxConsumerRegistry,
} from './outbox-drain';
import { createPubSubTokenRoutes } from './pubsub-token-routes';
import { createRequestDbMiddleware } from './request-db-middleware';
import {
  createRequestTelemetryMiddleware,
  takeRequestTraceId,
} from './request-telemetry';
import { createRoomApp } from './room-route';
import { createSyncApp } from './sync-app';
import { registerTelemetryConsumers } from './telemetry-consumers';

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

type ApiErrorContext = {
  req: { raw: Request };
  json: (body: { error: string; traceId?: string }, status: number) => Response;
};

function expectedApiError(err: unknown, c: ApiErrorContext): Response | null {
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
  return null;
}

function createApiErrorHandler(
  log: ReturnType<typeof createAppLogger>,
  exposeTraceId: boolean
) {
  return (err: unknown, c: ApiErrorContext) => {
    const requestTraceId = takeRequestTraceId(c.req.raw);
    const expected = expectedApiError(err, c);
    if (expected !== null) return expected;
    if (isAssertionFailure(err)) {
      activeSpan()?.recordException(new Error(err.message));
      log.error('assertion failure', {
        error: err.message,
        context: err.context,
      });
      return c.json(
        {
          error: 'Internal server error',
          ...(exposeTraceId && requestTraceId !== undefined
            ? { traceId: requestTraceId }
            : {}),
        },
        500
      );
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    const span = activeSpan();
    span?.recordException(err instanceof Error ? err : new Error(String(err)));
    span?.setStatus({ code: SpanStatusCode.ERROR, message });
    const traceId = currentCorrelation().traceId ?? requestTraceId;
    log.error('handler error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      {
        error: message,
        ...(exposeTraceId && traceId !== undefined ? { traceId } : {}),
      },
      500
    );
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
  readonly puzzleManagerAccountIds: readonly string[];
  readonly syntheticPopulationOperatorAccountIds: readonly string[];
}): Promise<DesiredClientConfig> {
  const { auth, secretStore } = args;
  const emqxWssUrl = await resolveEmqxWssUrlForClientConfig({
    secretStore,
    ...(args.apiUrlOverride !== undefined
      ? { apiUrlOverride: args.apiUrlOverride }
      : {}),
  });
  return {
    google: auth.signInMethods.includes('google'),
    apple: auth.signInMethods.includes('apple'),
    billing: args.billingConfigured,
    tts: args.ttsConfigured,
    llm: args.llmConfigured,
    googleWebClientId: null,
    emqxWssUrl,
    permissionPolicy: withSyntheticPopulationOperators(
      permissionPolicyForPuzzleManagers(args.puzzleManagerAccountIds),
      args.syntheticPopulationOperatorAccountIds
    ),
    billingGracePeriodMs: DEFAULT_BILLING_GRACE_PERIOD_MS,
  };
}

function createSyncAppMount(
  env: ServerEnv,
  app: ComposedSubs,
  servers: ComposedSubServers
) {
  return createSyncApp({
    app,
    authorizeServerMutation: servers.authorizeMutation,
    now: () => env.clock.now(),
    createId: env.createId,
    moderation: env.moderation,
    onCommittedMutations: (batch) =>
      drainCommittedMutationOutbox({
        batch,
        consumerRegistry: requestOutboxRegistry(servers.outboxConsumers),
        objectStore: env.blob,
        clock: env.clock,
        createId: env.createId,
      }),
    ...(env.protection === 'production' ? {} : { strictQueryLimits: true }),
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
  readonly servers: ComposedSubServers;
  readonly tts: Awaited<ReturnType<typeof createTtsAppForServer>>;
  readonly llm: Awaited<ReturnType<typeof createLlmAppForServer>>;
  readonly sync: Awaited<ReturnType<typeof createSyncApp>>;
  readonly log: ReturnType<typeof createAppLogger>;
}) {
  const { env, auth, desiredClientConfig, servers, tts, llm, sync, log } = args;
  const { secrets, protection } = env;

  const shell = new Hono<ApiHonoEnv<AuthContext>>()
    .use('*', createRequestTelemetryMiddleware(env.clock.now))
    .use(
      '*',
      createRequestDbMiddleware(secrets, {
        objectStore: env.blob,
        authServer: auth.server,
        authorizeSession: servers.authorizeSession,
        apiUrlOverride: env.serverUrl,
        protection,
        clock: env.clock,
        timers: env.timers,
        http: { fetch: env.fetch },
        createId: env.createId,
        desiredClientConfig,
        openSqlClient: env.openSqlClient,
        ...(env.skipDatabaseUrlPolicy ? { skipDatabaseUrlPolicy: true } : {}),
      })
    )
    .use('*', apiCors)
    .route('/', createHealthApp({ clock: env.clock, timers: env.timers }));
  mountBrowserTelemetryIngress(shell, env);
  mountAuthHandler(shell, auth);
  shell
    .route(
      '/',
      new AuthApiRoutes(env.clock, env.createId, (userIds) =>
        notifyUserChannels(userIds, 'auth-domain-write')
      ).build()
    )
    .route('/', sync)
    .route('/', createPubSubTokenRoutes(servers))
    .route('/', tts.app)
    .route('/', llm.app)
    .route('/', createRoomApp(servers.roomGrants));

  // Whatever the composed subs contribute, in walk order. The shell
  // mounts them; it does not know what any of them serves.
  const subRouters = servers.routers({
    authServer: auth.server,
    getSqlClient: () => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'sub routes: request store missing');
      return store.sqlClient;
    },
    clock: env.clock,
    createId: env.createId,
  });
  for (const router of subRouters) shell.route('/', router);
  return shell.onError(createApiErrorHandler(log, protection !== 'production'));
}

export type CreateServerArgs = {
  /** The folded sub set sync serves: schema, queries, topics, mutations. */
  readonly app: ComposedSubs;
  /** The same subs' server halves: routes, outbox consumers, topics. */
  readonly servers: ComposedSubServers;
};

/**
 * The auth service changed a user's sign-in methods without the product
 * asking: mirror them again and push them to the user's devices now, rather
 * than when a device next signs in.
 */
async function pushChangedAuthUser(
  auth: AuthProvider,
  externalUserId: string
): Promise<void> {
  const store = requireRequestStore();
  const accountId = await new ChangedAuthUserResync(
    store.sqlClient,
    auth.server,
    { now: () => store.clock.now(), createId: store.createId }
  ).resync(externalUserId);
  if (accountId === null) return;
  await notifyUserChannels([accountId], 'auth-user-changed');
}

/**
 * Composes the server app from mounted sub-apps (`app.route()`).
 *
 * The shell owns the platform routes — health, auth, sync, pubsub tokens,
 * rooms, matchmaking, the vendor apps — and mounts whatever the composed
 * subs contribute on top. It names no sub, so the same function
 * serves the whole product and a single bounded context under test.
 */
export async function createServer(env: ServerEnv, args: CreateServerArgs) {
  const log = createAppLogger(env);
  registerTelemetryConsumers(args.servers, env);
  setOutboxConsumerRegistry(args.servers.outboxConsumers, args.app.topicMap);

  if (env.events !== null) {
    setHttpPubSubOverride(env.events);
  }

  const billing = env.billing;
  const [auth, tts, llm, sync] = await Promise.all([
    createAuthProvider({
      module: env.auth,
      secretStore: env.secrets,
      apiUrlOverride: env.serverUrl,
      protection: env.protection,
      clock: env.clock,
      createId: env.createId,
      http: { fetch: env.fetch },
      onUserChanged: pushChangedAuthUser,
    }),
    createTtsAppForServer(env),
    createLlmAppForServer(env),
    createSyncAppMount(env, args.app, args.servers),
  ]);

  registerAccountDeletionConsumers(args.servers.outboxConsumers, auth.server);
  const desiredClientConfig = await buildDesiredClientConfig({
    secretStore: env.secrets,
    auth,
    billingConfigured: billing !== null,
    ttsConfigured: tts.configured,
    llmConfigured: llm.configured,
    puzzleManagerAccountIds: env.puzzleManagerAccountIds ?? [],
    syntheticPopulationOperatorAccountIds:
      env.syntheticPopulationOperatorAccountIds ?? [],
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
