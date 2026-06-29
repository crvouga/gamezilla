/**
 * Standalone HTTP server for the dev IdP. Mounts the {@link createDevIdpRouter}
 * Hono app under {@link DEV_IDP_PATH_PREFIX} on a Bun.serve listener, backed
 * by a long-lived Postgres connection (`SqlClientImplPgClient` → `KvImplPostgres`)
 * so the IdP's user / code / token records survive worker reloads and share
 * the same `kv` table the API also reads from.
 *
 * Spawns no Cloudflare worker, no Vault: the server is the
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
  isLoopbackPostgresUrl,
  openPgClient,
  type OpenPgClientResult,
} from '@pkgs/sql-client/postgres-connect';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { devIdpPostgresDbScope } from './postgres-schema-env';
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
   * Postgres connection string for the durable `Kv` backing the IdP.
   * Defaults to `process.env.DATABASE_URL` from `vault run` (Vault `dev`).
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

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_CONNECT_TIMEOUT_MS = 60_000;

type DevIdpPgSession = {
  pgClient: OpenPgClientResult['client'];
  kv: KvImplPostgres;
};

function attachPgClientErrorLogger(
  pgClient: OpenPgClientResult['client'],
  log: Logger
): void {
  pgClient.on('error', (err: Error) => {
    log.warn('dev-idp: postgres client error', { error: err.message });
  });
}

function isPgConnectionLostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('not queryable') ||
    msg.includes('Connection terminated') ||
    msg.includes('ECONNRESET') ||
    msg.includes('connection closed')
  );
}

async function openDevIdpPgSession(
  dbUrl: string,
  connectTimeoutMs: number,
  log: Logger
): Promise<DevIdpPgSession> {
  const { client: pgClient, sqlClient } = await connectPgWithRetry(
    dbUrl,
    connectTimeoutMs,
    log
  );
  attachPgClientErrorLogger(pgClient, log);
  const kv = await openKvForDevIdp(sqlClient, log, connectTimeoutMs);
  return { pgClient, kv };
}

async function ensureDevIdpPgSession(
  session: DevIdpPgSession,
  dbUrl: string,
  connectTimeoutMs: number,
  log: Logger
): Promise<void> {
  try {
    await session.pgClient.query('SELECT 1');
    return;
  } catch (err) {
    if (!isPgConnectionLostError(err)) throw err;
  }
  log.warn('dev-idp: postgres reconnecting after connection loss');
  try {
    await session.pgClient.end();
  } catch {
    /* client may already be dead */
  }
  const next = await openDevIdpPgSession(dbUrl, connectTimeoutMs, log);
  session.pgClient = next.pgClient;
  session.kv = next.kv;
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

function resolveDatabaseUrl(options: DevIdpServerOptions): string {
  const fromOptions = options.dbUrl?.trim() ?? '';
  const fromEnv = process.env['DATABASE_URL']?.trim() ?? '';
  const dbUrl = fromOptions.length > 0 ? fromOptions : fromEnv;
  assert.nonEmptyString(
    dbUrl,
    'DATABASE_URL is required — run the dev IdP under `vault run` (Vault `dev`) so Vault injects the hosted dev database URL'
  );
  if (isLoopbackPostgresUrl(dbUrl)) {
    assert.fail(
      'dev-idp: DATABASE_URL must not target loopback Postgres. Local embedded Postgres was removed; use Vault `dev` `DATABASE_URL`.',
      { dbUrl: maskDbUrl(dbUrl) }
    );
  }
  return dbUrl;
}

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
  const dbUrl = resolveDatabaseUrl(options);
  const connectTimeoutMs =
    options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  /* Build the browser bundle before binding the port so a build failure
   * fails the boot rather than serving a half-broken chooser page. */
  const clientBundle = await buildClientBundle();
  log.info('dev-idp: client bundle built', { bytes: clientBundle.bytes });

  const session = await openDevIdpPgSession(dbUrl, connectTimeoutMs, log);

  if (options.seedUsers !== undefined && options.seedUsers.length > 0) {
    const store = new DevIdpUserStore(session.kv);
    const seeded = await store.seedIfEmpty(options.seedUsers);
    log.info('dev-idp: seed check complete', { userCount: seeded.length });
  }

  const router = createDevIdpRouter({
    getKv: () => session.kv,
    clientBundle,
  });
  const app = new Hono();
  app.use('*', async (_c, next) => {
    await ensureDevIdpPgSession(session, dbUrl, connectTimeoutMs, log);
    await next();
  });
  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : String(err);
    log.error('dev-idp: request failed', { error: message });
    return c.text('Internal Server Error', 500);
  });
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

  const stop = createDevIdpStopHandler({
    server,
    getPgClient: () => session.pgClient,
    log,
  });

  return { url, port, stop };
}

function createDevIdpStopHandler(input: {
  readonly server: ReturnType<typeof Bun.serve>;
  readonly getPgClient: () => OpenPgClientResult['client'];
  readonly log: Logger;
}): () => Promise<void> {
  let stopped = false;
  return async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    try {
      await input.server.stop(true);
    } catch (e) {
      input.log.warn('dev-idp: server.stop threw', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      // Close the PostgreSQL connection. During shutdown, the connection
      // may already be terminated by the database server, so we suppress
      // connection-related errors.
      await input.getPgClient().end();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // Ignore "terminating connection due to administrator command" errors
      // that occur when Postgres shuts down during our shutdown sequence.
      if (
        !errorMsg.includes(
          'terminating connection due to administrator command'
        )
      ) {
        input.log.warn('dev-idp: pg client.end threw', {
          error: errorMsg,
        });
      }
    }
  };
}

/**
 * Connects to Postgres with linear backoff. Under `turbo dev` the hosted dev
 * database may take a moment to accept connections on a cold start.
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
      // `ensureSchema` so a fresh database (before `db:migrate`) gets the app schema.
      const result = await openPgClient({
        connectionString: dbUrl,
        dbScope: devIdpPostgresDbScope(),
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

/**
 * Waits for the shared `kv` table (created by `@apps/api` db:migrate under
 * turbo dev) instead of racing a second migrate. Falls back to
 * {@link KvImplPostgres.migrateUp} when the table is still missing after the
 * timeout — e.g. dev-idp started standalone.
 */
async function openKvForDevIdp(
  sqlClient: SqlClient,
  log: Logger,
  timeoutMs: number
): Promise<KvImplPostgres> {
  await waitForKvTable(sqlClient, log, timeoutMs);
  return new KvImplPostgres(sqlClient);
}

async function waitForKvTable(
  sqlClient: SqlClient,
  log: Logger,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    try {
      await sqlClient.query('SELECT 1 FROM kv LIMIT 1');
      if (attempt > 1) {
        log.info('dev-idp: kv table reachable', {
          attempt,
          elapsedMs: Date.now() - start,
        });
      }
      return;
    } catch (err) {
      if (attempt === 1 || attempt % 5 === 0) {
        log.info(
          'dev-idp: waiting for kv table (api migrate may still be running)',
          {
            attempt,
            elapsedMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          }
        );
      }
      await sleep(1_000);
    }
  }

  log.warn('dev-idp: kv table not found — running kv migrate as fallback');
  await KvImplPostgres.migrateUp({ sqlClient, logger: log });
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
