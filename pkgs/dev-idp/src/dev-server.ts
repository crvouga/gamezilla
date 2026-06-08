/**
 * Standalone HTTP server for the dev IdP. Mounts the {@link createDevIdpRouter}
 * Hono app under {@link DEV_IDP_PATH_PREFIX} on a Bun.serve listener, backed
 * by a long-lived Postgres connection (`SqlClientImplPgClient` → `KvImplPostgres`)
 * so the IdP's user / code / token records survive worker reloads and share
 * the same `kv` table the API also reads from.
 *
 * Spawns no Cloudflare worker, no Hyperdrive, no Vault: the server is the
 * dev-only counterpart to `@libs/stripe-cli` — `bun dev` boots it alongside
 * Postgres + Expo + the API worker so developers get a real OAuth IdP at a
 * known origin (`DEV_IDP_DEFAULT_ORIGIN`) without polluting the production
 * API surface.
 *
 * The server itself only knows how to start, serve, and stop. Signal handling
 * + foreground process lifecycle live in {@link ./dev.ts}.
 */
import { assert } from '@pkgs/assert';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger/logger';
import {
  openPgClient,
  type OpenPgClientResult,
} from '@pkgs/sql-client/postgres-connect';
import { gamezillaPostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import { Hono } from 'hono';

import { buildClientBundle } from './client-bundle';
import { DEV_IDP_DEFAULT_PORT, DEV_IDP_PATH_PREFIX } from './config';
import {
  DevIdpUserStore,
  type DevIdpUserCreateInput,
} from './dev-idp-user-store';
import { createDevIdpRouter } from './oauth2-router';

/** Inputs for {@link startDevIdpServer}. All fields optional with safe local defaults. */
export interface DevIdpServerOptions {
  /** TCP port to listen on. Defaults to {@link DEV_IDP_DEFAULT_PORT}. */
  readonly port?: number;
  /** Listen host. Defaults to `127.0.0.1`. */
  readonly host?: string;
  /**
   * Postgres connection string used for the durable `Kv` backing the IdP
   * (users, auth codes, access tokens). Defaults to the same local DSN
   * `@pkgs/postgres` exposes via `buildConnectionUrl` so a single
   * `bun dev` boots a fully wired stack.
   */
  readonly dbUrl?: string;
  /** Optional default test accounts seeded on first boot (idempotent). */
  readonly seedUsers?: readonly DevIdpUserCreateInput[];
  /** Optional logger; falls back to a no-op logger when omitted. */
  readonly logger?: Logger;
  /**
   * How long {@link startDevIdpServer} should wait for Postgres to accept
   * connections before giving up (Postgres usually boots a few seconds
   * after the IdP under `turbo dev`). Defaults to 60s.
   */
  readonly connectTimeoutMs?: number;
}

/** Returned by {@link startDevIdpServer}; call {@link stop} for graceful shutdown. */
export interface DevIdpServerHandle {
  readonly url: string;
  readonly port: number;
  readonly stop: () => Promise<void>;
}

const DEFAULT_DATABASE_URL =
  'postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_CONNECT_TIMEOUT_MS = 60_000;

/**
 * Boots the standalone dev IdP server. Resolves once Postgres is reachable,
 * migrations have run, and the HTTP listener is bound.
 */
export async function startDevIdpServer(
  options: DevIdpServerOptions = {}
): Promise<DevIdpServerHandle> {
  const log = options.logger ?? noopLogger();
  const port = options.port ?? DEV_IDP_DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const dbUrl = options.dbUrl ?? DEFAULT_DATABASE_URL;
  const connectTimeoutMs =
    options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  /* Build the browser bundle before binding the port so a build failure
   * fails the boot rather than serving a half-broken chooser page. */
  const clientBundle = await buildClientBundle();
  log.info('dev-idp: client bundle built', { bytes: clientBundle.bytes });

  const { client: pgClient, sqlClient } = await connectPgWithRetry(
    dbUrl,
    connectTimeoutMs,
    log
  );
  const kv = await KvImplPostgres.open({ sqlClient, logger: log });

  if (options.seedUsers !== undefined && options.seedUsers.length > 0) {
    const store = new DevIdpUserStore(kv);
    const seeded = await store.seedIfEmpty(options.seedUsers);
    log.info('dev-idp: seed check complete', { userCount: seeded.length });
  }

  const router = createDevIdpRouter({ getKv: () => kv, clientBundle });
  const app = new Hono();
  app.route(DEV_IDP_PATH_PREFIX, router);
  app.get('/', (c) => c.redirect(`${DEV_IDP_PATH_PREFIX}/authorize`));
  app.notFound((c) =>
    c.json({ error: 'not_found', path: new URL(c.req.raw.url).pathname }, 404)
  );

  const server = Bun.serve({
    port,
    hostname: host,
    fetch: (req) => app.fetch(req),
  });

  const url = `http://${host}:${String(port)}`;
  log.info('dev-idp: server listening', {
    url,
    authorize: `${url}${DEV_IDP_PATH_PREFIX}/authorize`,
  });

  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    try {
      await server.stop(true);
    } catch (e) {
      log.warn('dev-idp: server.stop threw', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      await pgClient.end();
    } catch (e) {
      log.warn('dev-idp: pg client.end threw', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return { url, port, stop };
}

/**
 * Connects to Postgres with linear backoff. Under `turbo dev` the IdP
 * and `@pkgs/postgres` start in parallel — the cluster typically takes
 * a few seconds to become reachable, so we retry instead of crashing.
 */
async function connectPgWithRetry(
  dbUrl: string,
  timeoutMs: number,
  log: Logger
): Promise<OpenPgClientResult> {
  const start = Date.now();
  let attempt = 0;
  let lastError: unknown = null;
  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    try {
      // `ensureSchema` so a fresh local cluster (started in parallel under
      // `turbo dev`, before `db:migrate`) gets the application schema.
      const result = await openPgClient({
        connectionString: dbUrl,
        dbScope: gamezillaPostgresDbScope(),
        ensureSchema: true,
      });
      if (attempt > 1) {
        log.info('dev-idp: postgres reachable', {
          attempt,
          elapsedMs: Date.now() - start,
        });
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt === 1 || attempt % 5 === 0) {
        log.info('dev-idp: waiting for postgres', {
          attempt,
          elapsedMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await sleep(1_000);
    }
  }
  assert.fail('dev-idp: postgres did not become reachable in time', {
    dbUrl: maskDbUrl(dbUrl),
    timeoutMs,
    lastError:
      lastError instanceof Error ? lastError.message : String(lastError),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strips the password from a Postgres URL for safe logging. */
function maskDbUrl(dbUrl: string): string {
  try {
    const u = new URL(dbUrl);
    if (u.password.length > 0) u.password = '***';
    return u.toString();
  } catch {
    return '***';
  }
}

function noopLogger(): Logger {
  const noop = (): void => {};
  const self: Logger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => self,
  };
  return self;
}
