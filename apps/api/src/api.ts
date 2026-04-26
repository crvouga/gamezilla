import { createLogger } from '@gamezilla/lib/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import {
  createCachingSecretStore,
  createCombinedSecretStore,
  DopplerSecretStore,
  isSecretStoreError,
} from '@gamezilla/lib/secret-store';
import { createApiApp } from './app/create-app';
import type { ApiWorkerEnv } from './config/env';
import { assertDopplerTokenBinding, ConfigurationError } from './config/env';
import { ApiSecretName } from './config/secret-names';
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

function selectDopplerEnvConfigNames(
  request: Request
): readonly ['local', 'prod'] | readonly ['prod', 'local'] {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === 'api.gamezilla.app' ? ['prod', 'local'] : ['local', 'prod'];
}

function latchFatal(reason: string): void {
  bootState = { kind: 'fatal', reason };
  if (!fatalLogged) {
    log.error('api fatal: refusing to serve', { reason });
    fatalLogged = true;
  }
}

async function bootApp(env: ApiWorkerEnv, request: Request): Promise<App> {
  const token = assertDopplerTokenBinding(env);
  const configNames = selectDopplerEnvConfigNames(request);
  const sharedStore = new DopplerSecretStore({ token, configName: 'shared' });

  let lastSecretStoreError: unknown;
  for (const runtimeConfigName of configNames) {
    try {
      const envStore = new DopplerSecretStore({
        token,
        configName: runtimeConfigName,
      });
      const combinedStore = createCombinedSecretStore(envStore, sharedStore);
      const secretStore = createCachingSecretStore(combinedStore, {
        ttlMs: 60_000,
      });

      const secrets = await secretStore.getRequiredMany([
        ApiSecretName.databaseUrl,
      ]);
      const databaseUrl = secrets[ApiSecretName.databaseUrl];
      if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
        throw new ConfigurationError(
          'DATABASE_URL was not returned from Doppler after getRequiredMany'
        );
      }
      const patchDb = getPatchDb(databaseUrl);
      await withTimeout(patchDb.migrate(), MIGRATE_TIMEOUT_MS, 'db.migrate');
      return createApiApp({
        db: patchDb,
        pubSub,
        secretStore,
      });
    } catch (err: unknown) {
      if (!isSecretStoreError(err) || runtimeConfigName === configNames.at(-1)) {
        throw err;
      }
      lastSecretStoreError = err;
    }
  }

  throw (lastSecretStoreError ??
    new ConfigurationError('Failed to resolve Doppler config'));
}

/**
 * Returns the booted app, or `null` if the isolate has permanently latched
 * into a fatal config state. Transient errors (DB unreachable, migrate
 * timeout) are re-thrown so the caller can fail this one request without
 * poisoning the isolate.
 */
async function ensureApp(
  env: ApiWorkerEnv,
  request: Request
): Promise<App | null> {
  if (bootState.kind === 'ready') return bootState.app;
  if (bootState.kind === 'fatal') return null;

  try {
    const app = await bootApp(env, request);
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
      const app = await ensureApp(env, request);
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
