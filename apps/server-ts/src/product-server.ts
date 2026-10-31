import { drainOutboxOnCron } from './outbox-cron';
import { runWorkerHttp } from './worker-http';
import {
  businessEventDeliveryOptions,
  ensureWorkerTelemetry,
  telemetryEndpointOptions,
  type WorkerTelemetryRuntime,
} from './worker-telemetry';

// @io-wall-ok
// @api-wall-ok

import { createServer } from '@libs/app-root-server-ts/create-server';
import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import { openRequestDb } from '@libs/app-root-server-ts/open-request-db-postgres';
import { observeScheduledOutboxDrain } from '@libs/app-root-server-ts/outbox-health';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import {
  assertSecretsEnvBinding,
  ConfigurationError,
  postgresConnectionString,
  readBillingProviderBinding,
  readDeploymentProtection,
  readOptionalApiUrlOverride,
  readOptionalDatabaseUrlOverride,
  readPuzzleManagerAccountIds,
  readSyntheticPopulationOperatorAccountIds,
  resolveCheckoutProvider,
  workerEnvToSecretRecord,
} from '@libs/app-root-shared-ts/env';
import { ApiSecretName } from '@libs/app-root-shared-ts/secret-names';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import type {
  ExecutionContext,
  ExportedHandler,
  ScheduledController,
} from '@libs/app-root-shared-ts/worker-handler';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { createRoomService } from '@libs/room-app-shared-ts/create-room-service';
import { APP_AUTH_PROVIDER } from '@libs/runtime-server-ts/app-auth-provider';
import { appSubServers } from '@libs/runtime-server-ts/app-sub-servers';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { composeSubServers } from '@libs/sub-shared-ts/compose-server';
import { context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ThrowingCrashHandler } from '@pkgs/assert-root-shared-ts/crash-handler-throwing';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { AuthProviderConfigError } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import {
  createConfiguredMembershipProviders,
  MembershipProviderConfigError,
  membershipSecretReader,
} from '@pkgs/billing-providers-server-ts/billing-providers';
import type { MembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';
import { InMemoryLlmProvider } from '@pkgs/llm-root-server-ts/in-memory-llm-provider';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { observeBackgroundWork } from '@pkgs/observability-root-server-ts/observe-background-work';
import {
  extractRequestContext,
  injectRequestHeaders,
} from '@pkgs/observability-root-server-ts/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';
import { pipelineHeartbeatContract } from '@pkgs/observability-root-shared-ts/pipeline-metrics';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import { isSecretStoreError } from '@pkgs/secret-store-shared-ts/is-secret-store-error';
import { InMemoryTtsProvider } from '@pkgs/tts-root-server-ts/in-memory-tts-provider';

assert.registerCrashHandler(new ThrowingCrashHandler());

function mintWallSeed(): bigint {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n === 0n ? 1n : n;
}

let wallSeed: bigint | undefined;

function getWallSeed(): bigint {
  wallSeed ??= mintWallSeed();
  return wallSeed;
}

const log = createLogger({ name: 'server', now: wallClock.now });
const workerHttp = createScopedHttpClient(createGlobalHttpClient());

type App = Awaited<ReturnType<typeof createServer>>;

type BootState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly app: App }
  | { readonly kind: 'fatal'; readonly reason: string };

let bootState: BootState = { kind: 'pending' };
let fatalLogged = false;

/**
 * Whether a 500 hides its trace id, as production does. Never throws — the
 * last-resort error path must answer even when misconfigured — and an
 * unreadable protection hides it too.
 */
function hidesErrorDetail(env: ApiWorkerEnv): boolean {
  try {
    return readDeploymentProtection(env) === 'production';
  } catch {
    return true;
  }
}

function observedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return withSpan(
    'http.client.request',
    () => {
      const headers = new Headers(init?.headers);
      injectRequestHeaders(headers);
      return workerHttp.fetch(input, { ...init, headers });
    },
    { [ATTR.HTTP_REQUEST_METHOD]: init?.method ?? 'GET' },
    { kind: SpanKind.CLIENT }
  );
}

/**
 * Better Auth (and credentialed browser fetches) require a concrete
 * `Access-Control-Allow-Origin` + `Allow-Credentials` — `*` fails preflight.
 */
function corsHeadersForRequest(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')?.trim() ?? '';
  if (origin.length > 0) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }
  return { 'Access-Control-Allow-Origin': '*' };
}

function preflightResponse(request: Request): Response {
  const requested = request.headers.get('Access-Control-Request-Headers');
  const allowHeaders =
    requested !== null && requested.trim().length > 0
      ? requested
      : 'Authorization, Cache-Control, Content-Type, Pragma, x-anon-id';
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeadersForRequest(request),
      'Access-Control-Allow-Methods':
        'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': allowHeaders,
    },
  });
}

/**
 * 503 for a Worker that cannot boot. The reason (which binding or secret is
 * wrong) is logged by `latchFatal`; production answers without it, as it hides
 * a 500's trace id, so the public learns nothing about its configuration.
 */
function fatalConfigResponse(
  request: Request,
  env: ApiWorkerEnv,
  reason: string
): Response {
  const body = hidesErrorDetail(env)
    ? { error: 'api misconfigured' }
    : { error: 'api misconfigured', reason };
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeadersForRequest(request),
    },
  });
}

function latchFatal(reason: string): void {
  bootState = { kind: 'fatal', reason };
  if (!fatalLogged) {
    log.error('api fatal: refusing to serve', { reason });
    fatalLogged = true;
  }
}

/**
 * Every membership provider this worker is configured for, and the one new
 * checkouts go to. Providers are a list this root iterates, never names:
 * each builds itself from the worker's secrets and bindings, and the app
 * never learns which it holds.
 */
async function createMembershipBilling(
  env: ApiWorkerEnv,
  secretStore: ReturnType<typeof createApiSecretStore>
): Promise<MembershipProviders | null> {
  try {
    return await createConfiguredMembershipProviders({
      env: {
        readSecret: membershipSecretReader(secretStore),
        offer: PLUS_MEMBERSHIP_OFFER,
        now: wallClock.now,
        fetch: observedFetch,
      },
      chooseCheckout: (configured) =>
        resolveCheckoutProvider(readBillingProviderBinding(env), configured),
    });
  } catch (error) {
    if (error instanceof MembershipProviderConfigError) {
      throw new ConfigurationError(error.message);
    }
    throw error;
  }
}

async function bootApp(env: ApiWorkerEnv): Promise<App> {
  const secretsEnv = assertSecretsEnvBinding(env);
  const secretStore = createApiSecretStore(
    workerEnvToSecretRecord(env),
    wallClock.now
  );
  const objectStore = await createApiObjectStore(secretStore, {
    secretsEnv,
    now: wallClock.now,
    http: workerHttp,
  });
  const dbScope = appPostgresDbScope();
  const serverUrl = readOptionalApiUrlOverride(env);
  const databaseUrlOverride = readOptionalDatabaseUrlOverride(env);
  const localStack = env['LOCALHOST_STACK'] === '1';
  const billing = await createMembershipBilling(env, secretStore);
  if (billing === null) {
    log.warn('no billing provider configured; billing routes will return 503');
  }

  const serverEnv: ServerEnv = {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    seed: getWallSeed(),
    openSqlClient: async () => {
      const override = databaseUrlOverride?.trim();
      const url =
        override !== undefined && override.length > 0
          ? override
          : (
              await secretStore.getRequired(ApiSecretName.dbUrl)
            ).readSecretValue();
      const opened = await openRequestDb(
        postgresConnectionString(env, url),
        dbScope
      );
      return opened.sqlClient;
    },
    events: null,
    kv: null,
    blob: objectStore,
    billing,
    tts: localStack ? new InMemoryTtsProvider() : null,
    llm: localStack ? new InMemoryLlmProvider() : null,
    secrets: secretStore,
    auth: APP_AUTH_PROVIDER,
    moderation: shippedModerationRules(),
    protection: readDeploymentProtection(env),
    puzzleManagerAccountIds: readPuzzleManagerAccountIds(env),
    syntheticPopulationOperatorAccountIds:
      readSyntheticPopulationOperatorAccountIds(env),
    serverUrl,
    ...telemetryEndpointOptions(env),
    ...businessEventDeliveryOptions(env, workerHttp, wallTimers),
    observabilityCollectorToken:
      env.OBSERVABILITY_COLLECTOR_TOKEN?.trim() || null,
    observabilityCollectorUser:
      env.OBSERVABILITY_COLLECTOR_USER?.trim() || null,
    skipDatabaseUrlPolicy: false,
    fetch: observedFetch,
  };

  const rooms = createRoomService(env.ROOM);
  return await createServer(serverEnv, {
    rooms,
    app: APP,
    servers: composeSubServers(appSubServers({ billing, rooms })),
  });
}

async function ensureApp(env: ApiWorkerEnv): Promise<App | null> {
  if (bootState.kind === 'ready') return bootState.app;
  if (bootState.kind === 'fatal') return null;

  try {
    const app = await bootApp(env);
    bootState = { kind: 'ready', app };
    return app;
  } catch (err: unknown) {
    if (
      err instanceof ConfigurationError ||
      err instanceof AuthProviderConfigError ||
      isSecretStoreError(err)
    ) {
      latchFatal(err instanceof Error ? err.message : String(err));
      return null;
    }
    throw err;
  }
}

function handleHealthRequest(
  request: Request,
  pathname: string
): Response | null {
  if (pathname !== '/api/health') return null;
  const cors = corsHeadersForRequest(request);
  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...cors },
    });
  }
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' as const }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors,
      },
    });
  }
  return null;
}

/**
 * Relative OAuth `callbackURL`s resolve against the API host. Bounce the SPA
 * route to the web client so Google return never 404s on `:8788`.
 */
function handleMisroutedSsoCallback(
  request: Request,
  env: ApiWorkerEnv
): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== '/sso-callback') return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const apiUrl =
    readOptionalApiUrlOverride(env) ??
    env.API_URL?.trim() ??
    'http://localhost:8788';
  const webOrigin = resolveWebClientOrigin(apiUrl);
  const dest = new URL(`/sso-callback${url.search}`, `${webOrigin}/`);
  return Response.redirect(dest.toString(), 302);
}

async function handleWorkerFetch(
  request: Request,
  env: ApiWorkerEnv,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  const health = handleHealthRequest(request, url.pathname);
  if (health !== null) return health;

  const ssoBounce = handleMisroutedSsoCallback(request, env);
  if (ssoBounce !== null) return ssoBounce;

  if (request.method === 'OPTIONS') {
    return preflightResponse(request);
  }

  const app = await ensureApp(env);
  if (app === null) {
    const reason = bootState.kind === 'fatal' ? bootState.reason : 'unknown';
    return fatalConfigResponse(request, env, reason);
  }

  return app.fetch(
    request,
    env,
    ctx as unknown as Parameters<typeof app.fetch>[2]
  );
}

const workerImplementation = {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    let telemetry: WorkerTelemetryRuntime = {
      flushWith: () => undefined,
      forceFlush: async () => undefined,
    };
    let traceId: string | undefined;
    try {
      telemetry = ensureWorkerTelemetry(
        env,
        () => crypto.randomUUID(),
        workerHttp
      );
      const parent = extractRequestContext(request.headers);
      return await context.with(parent, () =>
        withSpan(
          'worker.fetch',
          async (span) => {
            traceId = span.spanContext().traceId;
            const observedContext: ExecutionContext = {
              waitUntil: (work) =>
                ctx.waitUntil(
                  observeBackgroundWork(work, telemetry.forceFlush)
                ),
              passThroughOnException: () => ctx.passThroughOnException(),
            };
            const response = await handleWorkerFetch(
              request,
              env,
              observedContext
            );
            span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, response.status);
            if (response.status >= 500) {
              span.setStatus({ code: SpanStatusCode.ERROR });
            }
            return response;
          },
          {
            [ATTR.HTTP_REQUEST_METHOD]: request.method,
            [ATTR.CODE_FILE_PATH]: 'apps/server-ts/src/product-server.ts',
            [ATTR.CODE_FUNCTION_NAME]: 'fetch',
          },
          { kind: SpanKind.SERVER }
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ConfigurationError) {
        latchFatal(message);
        return fatalConfigResponse(request, env, message);
      }
      log.error('top-level handler error', { error: err });
      if (!hidesErrorDetail(env)) throw err;

      if (request.method === 'OPTIONS') {
        return preflightResponse(request);
      }

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          ...(hidesErrorDetail(env) || traceId === undefined
            ? {}
            : { traceId }),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...corsHeadersForRequest(request),
          },
        }
      );
    } finally {
      telemetry.flushWith(ctx.waitUntil.bind(ctx));
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const telemetry = ensureWorkerTelemetry(
      env,
      () => crypto.randomUUID(),
      workerHttp
    );
    const environment = deploymentTelemetryEnvironment(
      env.DEPLOYMENT_ENVIRONMENT
    );
    // The heartbeat says only that the schedule fired and telemetry flows, so
    // it stays ahead of the drain: a broken drain must not read as a broken
    // pipeline. Whether the drain works is its own count, `outbox.drain.runs`.
    createMetric(pipelineHeartbeatContract(environment))(1, {
      [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: environment,
    });
    try {
      await withSpan(
        'outbox.drain',
        async () => {
          const processed = await observeScheduledOutboxDrain(async () => {
            // A scheduled event may be this isolate's first invocation.
            if ((await ensureApp(env)) === null)
              throw new ConfigurationError(
                'Cannot drain outbox: application boot failed'
              );
            return drainOutboxOnCron(env, workerHttp, wallClock, () =>
              crypto.randomUUID()
            );
          });
          if (processed > 0) log.info('outbox cron drained', { processed });
        },
        {
          [ATTR.CODE_FILE_PATH]: 'apps/server-ts/src/product-server.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'scheduled',
        }
      );
    } catch (err: unknown) {
      log.error('outbox cron drain failed', { error: err });
      if (!hidesErrorDetail(env)) throw err;
    } finally {
      telemetry.flushWith(ctx.waitUntil.bind(ctx));
    }
  },
} satisfies ExportedHandler<ApiWorkerEnv>;

export default {
  ...workerImplementation,
  fetch(request, env, ctx) {
    return runWorkerHttp(workerHttp, env, ctx, (context) =>
      workerImplementation.fetch(request, env, context)
    );
  },
  scheduled(controller, env, ctx) {
    return runWorkerHttp(workerHttp, env, ctx, (context) =>
      workerImplementation.scheduled(controller, env, context)
    );
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
