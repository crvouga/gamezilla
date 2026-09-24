import { isLocalApiOrigin } from '@libs/auth/public/local-api-origin';
import type { AuthContext } from '@libs/auth/public/types';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { AuthApiRoutes } from '@libs/auth/root/server/auth-routes';
import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/client-config/public/client-config-defaults';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import type { ComposedFeatureServers } from '@libs/feature/public/compose-server';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/root/access-model';
import { PubsubSecretName } from '@libs/pubsub/public/secret-names';
import { setHttpPubSubOverride } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { assert, ForbiddenError, ValidationError } from '@pkgs/assert';
import type { AuthProvider } from '@pkgs/auth/server';
import { createLlmAppFromBindings } from '@pkgs/llm-openai';
import { createLogger } from '@pkgs/logger';
import {
  ATTR,
  activeSpan,
  context,
  currentCorrelation,
  deserializeTraceContext,
  otlpAuthorization,
  SpanKind,
  SpanStatusCode,
  withSpan,
} from '@pkgs/observability/core';
import type { SecretStore } from '@pkgs/secret-store';
import { createTtsAppFromBindings } from '@pkgs/tts-elevenlabs';
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { routePath } from 'hono/route';
import { API_PATH_PREFIX, createAuthProvider } from '../config/auth-provider';
import { ApiSecretName } from '../config/secret-names';
import { resolveWebClientOrigin } from '../config/web-client-origin';
import { createHealthApp } from '../health/route';
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

const requestTraceIds = new WeakMap<Request, string>();

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
    const requestTraceId = requestTraceIds.get(c.req.raw);
    requestTraceIds.delete(c.req.raw);
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

function createRequestTelemetryMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const traceparent = c.req.header('traceparent');
    const parent =
      traceparent === undefined
        ? undefined
        : deserializeTraceContext(traceparent);
    const run = () =>
      withSpan(
        'http.server.request',
        async (span) => {
          requestTraceIds.set(c.req.raw, span.spanContext().traceId);
          await next();
          if (c.res.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          span.setAttribute(ATTR.HTTP_ROUTE, routePath(c));
          span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, c.res.status);
          const outgoing = currentCorrelation().traceparent;
          if (outgoing !== undefined) c.header('traceparent', outgoing);
          requestTraceIds.delete(c.req.raw);
        },
        {
          [ATTR.HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR.CODE_FILE_PATH]: 'libs/server-app/src/app/create-server.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'createRequestTelemetryMiddleware',
        },
        { kind: SpanKind.SERVER }
      );
    return parent === undefined ? run() : context.with(parent, run);
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

function mountBrowserTelemetryIngress(
  shell: Hono<ApiHonoEnv<AuthContext>>,
  env: ServerEnv
): void {
  shell.post('/observability/v1/traces', async (c) => {
    const endpoint = env.observabilityCollectorUrl?.trim();
    if (endpoint === undefined || endpoint.length === 0) {
      return c.json({ error: 'observability_unavailable' }, 503);
    }
    const expectedOrigin =
      env.serverUrl === null ? null : resolveWebClientOrigin(env.serverUrl);
    const requestOrigin = c.req.header('origin')?.replace(/\/$/, '');
    if (
      env.secretsEnv === 'prd' &&
      (expectedOrigin === null || requestOrigin !== expectedOrigin)
    ) {
      return c.json({ error: 'observability_origin_denied' }, 403);
    }
    const contentType = c.req.header('content-type')?.toLowerCase() ?? '';
    if (
      !contentType.startsWith('application/x-protobuf') &&
      !contentType.startsWith('application/json')
    ) {
      return c.json({ error: 'observability_content_type_denied' }, 415);
    }
    const body = await readBoundedBody(c.req.raw, 5 * 1024 * 1024);
    if (body === null) {
      return c.json({ error: 'observability_payload_too_large' }, 413);
    }
    const headers = new Headers({
      'content-type': contentType,
    });
    const contentEncoding = c.req.header('content-encoding');
    if (contentEncoding !== undefined) {
      headers.set('content-encoding', contentEncoding);
    }
    const authorization = otlpAuthorization({
      user: env.observabilityCollectorUser,
      token: env.observabilityCollectorToken,
    });
    if (authorization !== undefined) {
      headers.set('authorization', authorization);
    }
    const response = await env.fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });
    return new Response(null, { status: response.status });
  });
}

async function readBoundedBody(
  request: Request,
  maxBytes: number
): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (request.body === null) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('observability payload too large');
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer as ArrayBuffer;
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
  const { secrets, secretsEnv } = env;

  const shell = new Hono<ApiHonoEnv<AuthContext>>()
    .use('*', createRequestTelemetryMiddleware())
    .use(
      '*',
      createRequestDbMiddleware(secrets, {
        authServer: auth.server,
        apiUrlOverride: env.serverUrl,
        secretsEnv,
        clock: env.clock,
        timers: env.timers,
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
  return shell.onError(createApiErrorHandler(log, secretsEnv !== 'prd'));
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
