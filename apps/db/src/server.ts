/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process (no socket server, no WS proxy). SQL execution is
 * implemented in {@link createSqlApp} and mounted here with `app.route()`.
 *
 * Invariants (Tiger Style): configuration is asserted at startup; the SQL
 * sub-app asserts request/result shape at its trust boundaries.
 */

import { PGlite } from '@electric-sql/pglite';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
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

const dbPackageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function resolveDataDir(): { path: string; source: 'env' | 'default' } {
  const raw = process.env['GAMEZILLA_DATA_DIR'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return { path: raw.trim(), source: 'env' };
  }
  return {
    path: join(dbPackageRoot, '.pglite', `port-${SQL_PORT}`),
    source: 'default',
  };
}

const { path: dataDir, source: dataDirSource } = resolveDataDir();
mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create(dataDir);

const app = new Hono()
  .get('/health', (c) => c.json({ ok: true }))
  .route('/', createSqlApp({ db, log }))
  .notFound((c) => c.json({ error: 'Not Found' }, 404));

Bun.serve({ port: SQL_PORT, hostname: HOST, fetch: app.fetch });

log.info('server started', {
  host: HOST,
  port: SQL_PORT,
  dataDir,
  dataDirSource,
});

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
