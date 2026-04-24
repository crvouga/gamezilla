import { createLogger } from '@gamezilla/lib/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { createApiApp } from './app/create-app';
import type { Env, ValidatedEnv } from './config/env';
import { ConfigurationError, validateEnv } from './config/env';
import { getPatchDb } from './db/patch-db';

const log = createLogger({ name: 'api' });

const MIGRATE_TIMEOUT_MS = 15_000;

const pubSub = new InMemoryPubSub();

type App = ReturnType<typeof createApiApp>;

/**
 * Per-isolate boot latch. The Cloudflare Worker runtime has no `process.exit`
 * available inside a Worker, so the closest approximation to a hard crash is
 * a permanent `fatal` state: the isolate refuses to serve real traffic and
 * every new isolate will re-observe the same fatal reason on first request.
 *
 * State transitions:
 *   pending -> ready   (happy path, once)
 *   pending -> fatal   (ConfigurationError, once, permanent for this isolate)
 *   pending -> pending (transient error — retried on next request)
 */
type BootState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly app: App }
  | { readonly kind: 'fatal'; readonly reason: string };

let bootState: BootState = { kind: 'pending' };
let fatalLogged = false;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Cache-Control, Pragma, Authorization',
} as const;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Browsers require CORS preflights to return a 2xx status; if the worker
 * crashes early (e.g. missing env), returning 500 here makes the browser
 * surface an opaque CORS error and hide the real cause. Always reply OK
 * for OPTIONS so the subsequent real request can fail with a readable body.
 */
function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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
      ...CORS_HEADERS,
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

async function bootApp(env: Env): Promise<App> {
  const validated: ValidatedEnv = validateEnv(env);
  const patchDb = getPatchDb(validated.databaseUrl);
  await withTimeout(patchDb.migrate(), MIGRATE_TIMEOUT_MS, 'db.migrate');
  return createApiApp({
    db: patchDb,
    pubSub,
    ...(validated.googleClientId !== null
      ? { googleClientId: validated.googleClientId }
      : {}),
  });
}

/**
 * Returns the booted app, or `null` if the isolate has permanently latched
 * into a fatal config state. Transient errors (DB unreachable, migrate
 * timeout) are re-thrown so the caller can fail this one request without
 * poisoning the isolate.
 */
async function ensureApp(env: Env): Promise<App | null> {
  if (bootState.kind === 'ready') return bootState.app;
  if (bootState.kind === 'fatal') return null;

  try {
    const app = await bootApp(env);
    bootState = { kind: 'ready', app };
    return app;
  } catch (err: unknown) {
    if (err instanceof ConfigurationError) {
      latchFatal(err.message);
      return null;
    }
    throw err;
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const app = await ensureApp(env);
      if (app === null) {
        if (request.method === 'OPTIONS') {
          return preflightResponse();
        }
        const reason =
          bootState.kind === 'fatal' ? bootState.reason : 'unknown';
        return fatalConfigResponse(reason);
      }
      return app.fetch(request, env);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('top-level handler error', { error: message });

      if (request.method === 'OPTIONS') {
        return preflightResponse();
      }

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
