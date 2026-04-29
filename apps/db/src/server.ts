/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process and in-memory (no socket server, no WS proxy, no
 * persistent data directory). Schema migrations run on startup before the
 * server begins accepting requests. SQL execution is implemented in
 * {@link createSqlApp} and mounted here with `app.route()`.
 *
 * Invariants (Tiger Style): configuration is asserted at startup; the SQL
 * sub-app asserts request/result shape at its trust boundaries.
 */

import { PGlite } from '@electric-sql/pglite';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { Hono } from 'hono';
import { migrateInProcessPglite } from './migrate';
import { createSqlApp } from './sql-app';

const HOST = '127.0.0.1';

const log = createLogger({ name: 'db' });

/**
 * Precondition: `SQL_PORT` env (if set) must be a decimal string in 1…65535.
 * Misconfiguration crashes the process — fail loudly at startup, not mid-request.
 */
function parseListenPortFromEnv(): number {
  const raw = process.env['SQL_PORT'] ?? '15432';
  const port = Number.parseInt(raw, 10);
  assert.ok(
    Number.isFinite(port) && port >= 1 && port <= 65_535,
    'SQL_PORT must be a valid TCP port (1–65535)',
    { raw, port }
  );
  return port;
}

const SQL_PORT = parseListenPortFromEnv();

const db = await PGlite.create();

const migrateStart = performance.now();
await migrateInProcessPglite(db, log);
log.info('migrations applied', {
  durationMs: Math.round((performance.now() - migrateStart) * 100) / 100,
});

const app = new Hono()
  .get('/health', (c) => c.json({ ok: true }))
  .route('/', createSqlApp({ db, log }))
  .notFound((c) => c.json({ error: 'Not Found' }, 404));

Bun.serve({ port: SQL_PORT, hostname: HOST, fetch: app.fetch });

log.info('server started', { host: HOST, port: SQL_PORT, storage: 'memory' });

const shutdown = async (signal: string) => {
  log.info('shutting down', { signal });
  try {
    await db.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('db.close failed', { error: message });
    process.exit(1);
  }
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
