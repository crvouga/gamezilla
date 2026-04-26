import { createLogger } from '@gamezilla/lib/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { isSecretStoreError } from '@gamezilla/lib/secret-store';
import { createApiApp } from './app/create-app';
import type { ApiWorkerEnv } from './config/env';
import {
  assertDbUrlBinding,
  assertDopplerTokenBinding,
  ConfigurationError,
} from './config/env';
import { createApiSecretStore } from './config/secret-store';
import { getPatchDb } from './db/patch-db';

const log = createLogger({ name: 'api' });

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
 *   pending -> fatal   (ConfigurationError / secret-store failure, once, permanent for this isolate)
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

async function bootApp(env: ApiWorkerEnv): Promise<App> {
  const token = assertDopplerTokenBinding(env);
  const databaseUrl = assertDbUrlBinding(env);
  const secretStore = createApiSecretStore(token);
  const patchDb = getPatchDb(databaseUrl);
  return createApiApp({
    db: patchDb,
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

export default {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
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
          'Cache-Control': 'no-store',
          ...CORS_HEADERS,
        },
      });
    }
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
