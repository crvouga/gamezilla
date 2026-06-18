import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/shared/load-game-plugins';
import { assert, ThrowingCrashHandler } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { InMemoryPubSub } from '@pkgs/pub-sub/impl-in-memory';
import { isSecretStoreError } from '@pkgs/secret-store';
import { createDurableObjectAdapter } from '@pkgs/room/server/adapters/durable-object';
import { tryBetterAuthOptionsResponse } from './app/cors';
import { createApiApp } from './app/create-app';
import type { ApiWorkerEnv } from './config/env';
import {
  assertVaultTokenBinding,
  ConfigurationError,
  readVaultScopeBindings,
  readOptionalApiUrlOverride,
  readOptionalDatabaseUrlOverride,
} from './config/env';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { createApiSecretStore } from './config/secret-store';
import { createApiObjectStore } from './config/object-store';

/**
 * On Cloudflare Workers (and `wrangler dev`'s node-shimmed runtime) the default
 * `NodeCrashHandler` would call `process.exit(1)` on every `assert.crash`,
 * which wrangler logs as `Canceling the request` and surfaces to clients as an
 * opaque 500 with no diagnostic context. Register the throwing handler first
 * (priority 10 beats `NodeCrashHandler`'s 30) so crashes become catchable
 * `AssertCrashError`s that the HTTP transport can serialize over the wire and
 * have the client re-raise locally with the original message + context.
 */
assert.registerCrashHandler(new ThrowingCrashHandler());

/**
 * Room Durable Object class for real-time topics. Games come from the eager
 * `GAME_DEFINITIONS` registry in `@libs/games`; the client uses the same
 * shared definitions so the two sides cannot drift.
 *
 * Exported as `Room` for Wrangler `class_name = "Room"` (see
 * `apps/api/wrangler.toml`).
 */
export const Room = createDurableObjectAdapter({
  modules: composeRoomModules(GAME_DEFINITIONS),
});

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
  const token = assertVaultTokenBinding(env);
  const { project, config, addr } = readVaultScopeBindings(env);
  const secretStore = createApiSecretStore(token, { project, config, addr });
  const objectStore = await createApiObjectStore(secretStore);
  const dbScope = appPostgresDbScope();
  return await createApiApp({
    pubSub,
    secretStore,
    dbScope,
    apiUrlOverride: readOptionalApiUrlOverride(env),
    databaseUrlOverride: readOptionalDatabaseUrlOverride(env),
    vaultConfig: readVaultScopeBindings(env).config,
    objectStore,
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

/**
 * Production traffic reaches this handler only for API paths (see
 * `run_worker_first` in `wrangler.toml` / `is-api-request-path.ts`).
 * Static web assets are served by the ASSETS binding for all other routes.
 */
async function handleWorkerFetch(
  request: Request,
  env: ApiWorkerEnv,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // Keep health checks independent from DB pressure so deploy checks and
  // load-balancer liveness don't flap when Postgres is saturated.
  if (url.pathname === '/api/health') {
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
