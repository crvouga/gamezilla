// @io-wall-ok
// @api-wall-ok

// Must be first: installs native ALS on globalThis before any `@pkgs/async-local` construction.
import './install-native-als';

import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { assertNonProdDatabaseUrl } from '@libs/db/public/database-url-policy';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { composeFeatureServers } from '@libs/feature/public/compose-server';
import { APP } from '@libs/runtime/root/app-features';
import { APP_AUTH_PROVIDER } from '@libs/runtime/root/server/app-auth-provider';
import { appFeatureServers } from '@libs/runtime/root/server/app-feature-servers';
import { createServer } from '@libs/server-app/app/create-server';
import type { ServerEnv } from '@libs/server-app/app/server-env';
import type { ApiWorkerEnv } from '@libs/server-app/config/env';
import {
  assertSecretsEnvBinding,
  ConfigurationError,
  postgresConnectionString,
  readBillingProviderBinding,
  readDeploymentProtection,
  readOptionalApiUrlOverride,
  readOptionalDatabaseUrlOverride,
  resolveCheckoutProvider,
  workerEnvToSecretRecord,
} from '@libs/server-app/config/env';
import { createApiObjectStore } from '@libs/server-app/config/object-store';
import { ApiSecretName } from '@libs/server-app/config/secret-names';
import { createApiSecretStore } from '@libs/server-app/config/secret-store';
import { resolveWebClientOrigin } from '@libs/server-app/config/web-client-origin';
import { openRequestDb } from '@libs/server-app/db/open-request-db-postgres';
import { wrapSqlClientForObservability } from '@libs/server-app/observability/wrap-sql-client';
import { drainAndNotifyOutbox } from '@libs/server-app/sync/outbox-drain';
import { assert, ThrowingCrashHandler } from '@pkgs/assert';
import { AuthProviderConfigError } from '@pkgs/auth/server';
import type { MembershipProviders } from '@pkgs/billing';
import {
  createConfiguredMembershipProviders,
  MembershipProviderConfigError,
  membershipSecretReader,
} from '@pkgs/billing-providers';
import { wallClock, wallTimers } from '@pkgs/clock';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { createLogger } from '@pkgs/logger';
import {
  ATTR,
  context,
  createWorkerTelemetry,
  deploymentTelemetryEnvironment,
  extractRequestContext,
  injectRequestHeaders,
  otlpAuthorization,
  SpanKind,
  SpanStatusCode,
  withSpan,
} from '@pkgs/observability/worker';
import { isSecretStoreError } from '@pkgs/secret-store';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

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

type App = Awaited<ReturnType<typeof createServer>>;

type BootState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly app: App }
  | { readonly kind: 'fatal'; readonly reason: string };

let bootState: BootState = { kind: 'pending' };
let fatalLogged = false;
type WorkerTelemetryRuntime = {
  readonly flushWith: (waitUntil: (promise: Promise<unknown>) => void) => void;
};
let workerTelemetry: WorkerTelemetryRuntime | null = null;

function ensureWorkerTelemetry(env: ApiWorkerEnv): WorkerTelemetryRuntime {
  if (workerTelemetry !== null) return workerTelemetry;
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') {
    workerTelemetry = { flushWith: () => undefined };
    return workerTelemetry;
  }
  const production = readDeploymentProtection(env) === 'production';
  const collectorUrl = env.OBSERVABILITY_COLLECTOR_URL?.trim();
  if (collectorUrl === undefined || collectorUrl.length === 0) {
    if (production) {
      throw new ConfigurationError(
        'OBSERVABILITY_COLLECTOR_URL is required in production unless OBSERVABILITY_ENABLED=0'
      );
    }
    workerTelemetry = { flushWith: () => undefined };
    return workerTelemetry;
  }
  const buildSha = env.BUILD_SHA?.trim() || 'development';
  const collectorToken = env.OBSERVABILITY_COLLECTOR_TOKEN?.trim();
  if (
    production &&
    (collectorToken === undefined || collectorToken.length === 0)
  ) {
    throw new ConfigurationError(
      'OBSERVABILITY_COLLECTOR_TOKEN is required in production'
    );
  }
  const authorization = otlpAuthorization({
    user: env.OBSERVABILITY_COLLECTOR_USER,
    token: collectorToken,
  });
  workerTelemetry = createWorkerTelemetry({
    serviceName: 'gamezilla-server',
    serviceVersion: buildSha,
    environment: deploymentTelemetryEnvironment(env.DEPLOYMENT_ENVIRONMENT),
    buildSha,
    otlpUrl: collectorUrl,
    ...(authorization === undefined
      ? {}
      : { otlpHeaders: { Authorization: authorization } }),
  });
  return workerTelemetry;
}

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
      return globalThis.fetch(input, { ...init, headers });
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

function fatalConfigResponse(request: Request, reason: string): Response {
  return new Response(JSON.stringify({ error: 'api misconfigured', reason }), {
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
    http: { fetch: (input, init) => globalThis.fetch(input, init) },
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
    protection: readDeploymentProtection(env),
    serverUrl,
    observabilityCollectorUrl: env.OBSERVABILITY_COLLECTOR_URL?.trim() || null,
    observabilityCollectorToken:
      env.OBSERVABILITY_COLLECTOR_TOKEN?.trim() || null,
    observabilityCollectorUser:
      env.OBSERVABILITY_COLLECTOR_USER?.trim() || null,
    skipDatabaseUrlPolicy: false,
    fetch: observedFetch,
  };

  return await createServer(serverEnv, {
    app: APP,
    servers: composeFeatureServers(appFeatureServers({ billing })),
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
    return fatalConfigResponse(request, reason);
  }

  return app.fetch(
    request,
    env,
    ctx as unknown as Parameters<typeof app.fetch>[2]
  );
}

/** Sweeper for stranded outbox deliveries (cron). Opens its own DB session. */
async function drainOutboxOnCron(env: ApiWorkerEnv): Promise<void> {
  const secretsEnv = assertSecretsEnvBinding(env);
  const secretStore = createApiSecretStore(
    workerEnvToSecretRecord(env),
    wallClock.now
  );
  const override = readOptionalDatabaseUrlOverride(env);
  const dbUrl =
    override !== null && override.length > 0
      ? override
      : (await secretStore.getRequired(ApiSecretName.dbUrl)).readSecretValue();
  if (readDeploymentProtection(env) !== 'production') {
    await assertNonProdDatabaseUrl(dbUrl, {
      surface: 'api-worker-cron',
      secretsEnv,
    });
  }
  const opened = await openRequestDb(
    postgresConnectionString(env, dbUrl),
    appPostgresDbScope()
  );
  try {
    const processed = await drainAndNotifyOutbox({
      db: wrapSqlClientForObservability(opened.sqlClient),
      clock: wallClock,
      createId: () => crypto.randomUUID(),
    });
    if (processed > 0) {
      log.info('outbox cron drained', { processed });
    }
  } finally {
    if (opened.kind === 'postgres') {
      await opened.pool.end();
    }
  }
}

const workerHandler = {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    let telemetry: WorkerTelemetryRuntime = { flushWith: () => undefined };
    let traceId: string | undefined;
    try {
      telemetry = ensureWorkerTelemetry(env);
      const parent = extractRequestContext(request.headers);
      return await context.with(parent, () =>
        withSpan(
          'worker.fetch',
          async (span) => {
            traceId = span.spanContext().traceId;
            const response = await handleWorkerFetch(request, env, ctx);
            span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, response.status);
            if (response.status >= 500) {
              span.setStatus({ code: SpanStatusCode.ERROR });
            }
            return response;
          },
          {
            [ATTR.HTTP_REQUEST_METHOD]: request.method,
            [ATTR.CODE_FILE_PATH]: 'apps/server/src/server.ts',
            [ATTR.CODE_FUNCTION_NAME]: 'fetch',
          },
          { kind: SpanKind.SERVER }
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ConfigurationError) {
        latchFatal(message);
        return fatalConfigResponse(request, message);
      }
      log.error('top-level handler error', { error: message });

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
    const telemetry = ensureWorkerTelemetry(env);
    try {
      await withSpan('outbox.drain', () => drainOutboxOnCron(env), {
        [ATTR.CODE_FILE_PATH]: 'apps/server/src/server.ts',
        [ATTR.CODE_FUNCTION_NAME]: 'scheduled',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('outbox cron drain failed', { error: message });
    } finally {
      telemetry.flushWith(ctx.waitUntil.bind(ctx));
    }
  },
} satisfies ExportedHandler<ApiWorkerEnv>;

export default workerHandler;
