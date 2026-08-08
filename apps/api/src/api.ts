import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { composeRoomModules } from '@libs/spaces/shared/load-game-plugins';
import { assert, ThrowingCrashHandler } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { createServerObservability } from '@pkgs/observability/server/create-server-observability';
import { createDurableObjectAdapter } from '@pkgs/room/server/adapters/durable-object';
import { isSecretStoreError } from '@pkgs/secret-store';
import * as Sentry from '@sentry/cloudflare';
import { createApiApp } from './app/create-app';
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
import { createApiSecretStore } from './config/secret-store';
import { resolveWebClientOrigin } from './config/web-client-origin';

assert.registerCrashHandler(new ThrowingCrashHandler());

export const Room = createDurableObjectAdapter({
  modules: composeRoomModules(GAME_DEFINITIONS),
});

const log = createLogger({ name: 'api' });

type App = Awaited<ReturnType<typeof createApiApp>>;

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
  const secretStore = createApiSecretStore(workerEnvToSecretRecord(env));
  const objectStore = await createApiObjectStore(secretStore, {
    secretsEnv,
  });
  const dbScope = appPostgresDbScope();
  const observability = createServerObservability({
    serviceName: 'gamezilla-api',
    envBackend: env.OBSERVABILITY_BACKEND,
    isProduction: secretsEnv === 'prd',
    ...(env.OBSERVABILITY_COLLECTOR_URL !== undefined &&
    env.OBSERVABILITY_COLLECTOR_URL.length > 0
      ? { collectorUrl: env.OBSERVABILITY_COLLECTOR_URL }
      : {}),
  });

  const apiUrlOverride = readOptionalApiUrlOverride(env);
  const betterAuth = await loadBetterAuthBootConfig({
    secretStore,
    apiUrlOverride,
    secretsEnv,
  });

  return await createApiApp({
    secretStore,
    betterAuth,
    dbScope,
    apiUrlOverride,
    databaseUrlOverride: readOptionalDatabaseUrlOverride(env),
    secretsEnv,
    objectStore,
    observability,
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
    readOptionalApiUrlOverride(env) ?? env.API_URL?.trim() ?? 'http://localhost:8788';
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
} satisfies ExportedHandler<ApiWorkerEnv>;

function sentryWorkerOptions(env: ApiWorkerEnv):
  | {
      dsn: string;
      tracesSampleRate: number;
      environment: string;
    }
  | Record<string, never> {
  const backend = env.OBSERVABILITY_BACKEND?.trim().toLowerCase();
  const dsn = env.SENTRY_DSN?.trim();
  if (backend !== 'sentry' || dsn === undefined || dsn.length === 0) {
    return {};
  }
  return {
    dsn,
    tracesSampleRate: 1.0,
    environment: env.SECRETS_ENV ?? 'dev',
  };
}

export default Sentry.withSentry(sentryWorkerOptions, workerHandler);
