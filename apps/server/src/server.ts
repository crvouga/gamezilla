// @io-wall-ok
// @api-wall-ok

// Must be first: installs native ALS on globalThis before any `@pkgs/async-local` construction.
import './install-native-als';

import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import {
  assertDatabaseUrlAllowedForSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assert, ThrowingCrashHandler } from '@pkgs/assert';
import { createStripeBillingFromSecretStore } from '@pkgs/billing-stripe';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { createServerObservability } from '@pkgs/observability/server/create-server-observability';
import { isSecretStoreError } from '@pkgs/secret-store';
import { createServer } from './app/create-server';
import type { ServerEnv } from './app/server-env';
import { loadBetterAuthBootConfig } from './config/better-auth-boot';
import type { ApiWorkerEnv } from './config/env';
import {
  assertSecretsEnvBinding,
  ConfigurationError,
  readOptionalApiUrlOverride,
  readOptionalDatabaseUrlOverride,
  workerEnvToSecretRecord,
} from './config/env';
import { createApiObjectStore } from './config/object-store';
import { ApiSecretName } from './config/secret-names';
import { createApiSecretStore } from './config/secret-store';
import { resolveWebClientOrigin } from './config/web-client-origin';
import { openRequestDb } from './db/open-request-db-postgres';
import { drainAndNotifyOutbox } from './sync/outbox-drain';

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

const wallSeed = mintWallSeed();
const log = createLogger({ name: 'server', now: wallClock.now });

type App = Awaited<ReturnType<typeof createServer>>;

type BootState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly app: App }
  | { readonly kind: 'fatal'; readonly reason: string };

let bootState: BootState = { kind: 'pending' };
let fatalLogged = false;

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

async function bootApp(env: ApiWorkerEnv): Promise<App> {
  const secretsEnv = assertSecretsEnvBinding(env);
  const secretStore = createApiSecretStore(
    workerEnvToSecretRecord(env),
    wallClock.now
  );
  const objectStore = await createApiObjectStore(secretStore, {
    secretsEnv,
    now: wallClock.now,
  });
  const dbScope = appPostgresDbScope();
  const observability = createServerObservability({
    serviceName: 'gamezilla-server',
    now: wallClock.now,
    createId: () => crypto.randomUUID(),
    envBackend: env.OBSERVABILITY_BACKEND,
    isProduction: secretsEnv === 'prd',
    ...(env.OBSERVABILITY_COLLECTOR_URL !== undefined &&
    env.OBSERVABILITY_COLLECTOR_URL.length > 0
      ? { collectorUrl: env.OBSERVABILITY_COLLECTOR_URL }
      : {}),
  });

  const serverUrl = readOptionalApiUrlOverride(env);
  const databaseUrlOverride = readOptionalDatabaseUrlOverride(env);
  const betterAuth = await loadBetterAuthBootConfig({
    secretStore,
    apiUrlOverride: serverUrl,
    secretsEnv,
  });

  const billing = await createStripeBillingFromSecretStore(secretStore);
  if (billing === null) {
    log.warn('billing secret key missing; billing routes will return 503');
  }

  const serverEnv: ServerEnv = {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    seed: wallSeed,
    openSqlClient: async () => {
      const override = databaseUrlOverride?.trim();
      const url =
        override !== undefined && override.length > 0
          ? override
          : (
              await secretStore.getRequired(ApiSecretName.dbUrl)
            ).readSecretValue();
      const opened = await openRequestDb(url, dbScope);
      return opened.sqlClient;
    },
    events: null,
    kv: null,
    blob: objectStore,
    billing,
    tts: null,
    llm: null,
    secrets: secretStore,
    observability,
    betterAuth,
    secretsEnv,
    serverUrl,
    skipDatabaseUrlPolicy: false,
    fetch: (input, init) => globalThis.fetch(input, init),
  };

  return await createServer(serverEnv);
}

async function ensureApp(env: ApiWorkerEnv): Promise<App | null> {
  if (bootState.kind === 'ready') return bootState.app;
  if (bootState.kind === 'fatal') return null;

  try {
    const app = await bootApp(env);
    bootState = { kind: 'ready', app };
    return app;
  } catch (err: unknown) {
    if (err instanceof ConfigurationError || isSecretStoreError(err)) {
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
  if (secretsEnv === DEVELOPMENT_SECRETS_ENV) {
    await assertDatabaseUrlAllowedForSecretsEnv(dbUrl, secretsEnv, {
      surface: 'api-worker-cron',
    });
  }
  const opened = await openRequestDb(dbUrl, appPostgresDbScope());
  try {
    const processed = await drainAndNotifyOutbox({
      db: opened.sqlClient,
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
    try {
      return await handleWorkerFetch(request, env, ctx);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('top-level handler error', { error: message });

      if (request.method === 'OPTIONS') {
        return preflightResponse(request);
      }

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeadersForRequest(request),
        },
      });
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: ApiWorkerEnv,
    _ctx: ExecutionContext
  ): Promise<void> {
    try {
      await drainOutboxOnCron(env);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('outbox cron drain failed', { error: message });
    }
  },
} satisfies ExportedHandler<ApiWorkerEnv>;

export default workerHandler;
