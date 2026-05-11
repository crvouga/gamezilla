import { createLogger } from '@gamezilla/lib/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { isSecretStoreError } from '@gamezilla/lib/secret-store';
import { APP_SPACE_MODULE } from '@gamezilla/app/shared/games';
import { createDurableObjectAdapter } from '@gamezilla/room/server/adapters/durable-object';
import { createApiApp } from './app/create-app';
import { tryBetterAuthOptionsResponse } from './app/cors';
import type { ApiWorkerEnv } from './config/env';
import {
  assertDopplerTokenBinding,
  ConfigurationError,
  readDopplerScopeBindings,
} from './config/env';
import { createApiSecretStore } from './config/secret-store';

/**
 * Space Durable Object class for the real-time room. The composed module is
 * sourced from `@gamezilla/app` so the server and client share the exact
 * same game registry and can never disagree on routers/reducers.
 *
 * Exported as `Space` so Wrangler's `class_name = "Space"` binding (see
 * `packages/api/wrangler.toml`) finds the DO class on the worker entry.
 */
const Space = createDurableObjectAdapter({ module: APP_SPACE_MODULE });

const log = createLogger({ name: 'api' });

const pubSub = new InMemoryPubSub();

type App = Awaited<ReturnType<typeof createApiApp>>;

/**
 * Per-isolate boot latch. The Cloudflare Worker runtime has no `process.exit`
 * available inside a Worker, so the closest approximation to a hard crash is
 * a permanent `fatal` state: the isolate refuses to serve real traffic and
 * every new isolate will re-observe the same fatal reason on first request.
 *
 * State transitions:
 *   pending -> ready   (happy path, once)
 *   pending -> fatal   (ConfigurationError / secret-store failure, once, permanent for this isolate)
 *   pending -> pending (transient error — retried on next request)
 */
type BootState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly app: App }
  | { readonly kind: 'fatal'; readonly reason: string };

let bootState: BootState = { kind: 'pending' };
let fatalLogged = false;

const ERROR_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
} as const;

/**
 * Browsers require CORS preflights to return a 2xx status; if the worker
 * crashes early (e.g. missing env), returning 500 here makes the browser
 * surface an opaque CORS error and hide the real cause. Always reply OK
 * for OPTIONS so the subsequent real request can fail with a readable body.
 *
 * Echo `Access-Control-Request-Headers` when present so preflight matches what
 * libraries (e.g. Better Auth) actually send; a fixed short list fails preflight.
 */
function preflightResponse(request: Request): Response {
  const requested = request.headers.get('Access-Control-Request-Headers');
  const allowHeaders =
    requested !== null && requested.trim().length > 0
      ? requested
      : 'Authorization, Cache-Control, Content-Type, Pragma, x-anon-id';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':
        'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': allowHeaders,
    },
  });
}

/**
 * 503 with a distinctive, non-transient shape so clients and humans can
 * tell config failure apart from a generic internal error.
 */
function fatalConfigResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: 'api misconfigured', reason }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...ERROR_CORS_HEADERS,
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
  const token = assertDopplerTokenBinding(env);
  const { project, config } = readDopplerScopeBindings(env);
  const secretStore = createApiSecretStore(token, { project, config });
  if (env.HYPERDRIVE === undefined || env.HYPERDRIVE === null) {
    throw new ConfigurationError(
      'HYPERDRIVE Worker binding is required — add [[hyperdrive]] to packages/api/wrangler.toml'
    );
  }
  return await createApiApp({
    pubSub,
    secretStore,
  });
}

/**
 * Returns the booted app, or `null` if the isolate has permanently latched
 * into a fatal config state. Transient errors (for example DB connectivity)
 * are re-thrown so the caller can fail this one request without
 * poisoning the isolate.
 */
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

async function handleWorkerFetch(
  request: Request,
  env: ApiWorkerEnv,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // Keep health checks independent from DB pressure so deploy checks and
  // load-balancer liveness don't flap when Postgres is saturated.
  if (url.pathname === '/health') {
    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...ERROR_CORS_HEADERS },
      });
    }
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' as const }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...ERROR_CORS_HEADERS,
        },
      });
    }
  }

  // Preflights must not depend on app boot / database availability.
  if (request.method === 'OPTIONS') {
    const authPreflight = tryBetterAuthOptionsResponse(request);
    return authPreflight ?? preflightResponse(request);
  }

  const app = await ensureApp(env);
  if (app === null) {
    const reason = bootState.kind === 'fatal' ? bootState.reason : 'unknown';
    return fatalConfigResponse(reason);
  }

  // Cast: Cloudflare's `ExecutionContext` lacks Hono's newer `props` field,
  // but Hono only reads `waitUntil`/`passThroughOnException` at runtime.
  return app.fetch(
    request,
    env,
    ctx as unknown as Parameters<typeof app.fetch>[2]
  );
}

export { Space };

export default {
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
          ...ERROR_CORS_HEADERS,
        },
      });
    }
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
