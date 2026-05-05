/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process; persistence is filesystem-backed by default so
 * snapshots/patches survive restarts during local development. Schema
 * migrations run on startup before the server begins accepting requests
 * (DDL is idempotent, so re-running against an existing data dir is safe).
 * SQL execution is implemented in {@link createSqlApp} and mounted here
 * with `app.route()`.
 *
 * Storage selection:
 * - `DB_DATA_DIR` unset            → `apps/db/.pglite` (filesystem, durable).
 * - `DB_DATA_DIR=memory://`        → ephemeral in-memory PGlite (legacy mode).
 * - `DB_DATA_DIR=/abs/or/rel/path` → that directory (resolved against repo root).
 *
 * Invariants (Tiger Style): configuration is asserted at startup; the SQL
 * sub-app asserts request/result shape at its trust boundaries.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { Hono } from 'hono';
import { migrateInProcessPglite } from './migrate';
import { createSqlApp } from './sql-app';

const HOST = '127.0.0.1';

const log = createLogger({ name: 'db' });

/** Local PGlite HTTP dev server — fixed port (matches default `DB_URL` in Doppler `local`). */
const SQL_PORT = 15_432;

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(SERVER_DIR, '..');
const DEFAULT_DATA_DIR = resolve(APP_ROOT, '.pglite');
const MEMORY_PREFIX = 'memory://';

type StorageConfig =
  | { kind: 'memory'; dataDir: typeof MEMORY_PREFIX }
  | { kind: 'filesystem'; dataDir: string };

/**
 * Untrusted env: resolves `DB_DATA_DIR` to either the in-memory sentinel or
 * an absolute filesystem path rooted at the app dir. Relative paths are
 * resolved against `apps/db/` so behavior is independent of the caller's CWD.
 */
function resolveStorageConfig(envValue: string | undefined): StorageConfig {
  const trimmed = envValue?.trim();
  if (trimmed === undefined || trimmed === '') {
    return { kind: 'filesystem', dataDir: DEFAULT_DATA_DIR };
  }
  if (trimmed === MEMORY_PREFIX) {
    return { kind: 'memory', dataDir: MEMORY_PREFIX };
  }
  assert.ok(
    !trimmed.includes('://'),
    'DB_DATA_DIR must be a filesystem path or "memory://"',
    { value: trimmed }
  );
  const dataDir = isAbsolute(trimmed) ? trimmed : resolve(APP_ROOT, trimmed);
  return { kind: 'filesystem', dataDir };
}

const storage = resolveStorageConfig(process.env['DB_DATA_DIR']);

if (storage.kind === 'filesystem') {
  await mkdir(storage.dataDir, { recursive: true });
}

const db = await PGlite.create(storage.dataDir);

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

log.info('server started', {
  host: HOST,
  port: SQL_PORT,
  storage: storage.kind,
  dataDir: storage.dataDir,
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
