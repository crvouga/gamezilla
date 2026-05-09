/**
 * Local dev Postgres wire compatibility via PGlite + TCP socket server.
 *
 * @see https://pglite.dev/docs/pglite-socket
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tiger style (see repo `LLM.md`): validate env-derived listen config; never accept silently
 * malformed host/port.
 */
const log = createLogger({ name: 'db:pglite-socket' });

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_DATA_DIR = resolve(APP_ROOT, '.pglite');
const MEMORY_PREFIX = 'memory://';

function readHost(): string {
  const raw = process.env['PGLITE_HOST']?.trim();
  const host = raw === undefined || raw === '' ? '127.0.0.1' : raw;
  assert.nonEmptyString(host, 'PGLITE_HOST must be a non-empty string', {
    raw,
  });
  return host;
}

function readPort(): number {
  const raw = process.env['PGLITE_PORT']?.trim();
  const s = raw === undefined || raw === '' ? '5432' : raw;
  const n = Number(s);
  assert.integer(
    n,
    `PGLITE_PORT must be an integer (raw: ${JSON.stringify(s)})`
  );
  assert.ok(n >= 1 && n <= 65_535, 'PGLITE_PORT must be in 1..65535', {
    port: n,
  });
  return n;
}

const PORT = readPort();
const HOST = readHost();

function pgliteDevDbUrl(host: string, port: number): string {
  return `postgres://postgres:postgres@${host}:${String(port)}/postgres?sslmode=disable`;
}
// postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable
function resolveDataDir(): string {
  const raw = process.env['PGLITE_DATA_DIR']?.trim();
  if (raw === undefined || raw === '') return DEFAULT_DATA_DIR;
  if (raw === MEMORY_PREFIX) return MEMORY_PREFIX;
  return isAbsolute(raw) ? raw : resolve(APP_ROOT, raw);
}

const dataDir = resolveDataDir();

async function main(): Promise<void> {
  if (dataDir !== MEMORY_PREFIX) {
    await mkdir(dataDir, { recursive: true });
  }

  const db = await PGlite.create(dataDir);
  const server = new PGLiteSocketServer({
    db,
    port: PORT,
    host: HOST,
    // PGLiteSocketServer defaults to `maxConnections: 1`; concurrent Worker
    // requests (each opening a per-request `pg.Client` for Hyperdrive) get
    // rejected with "Too many connections", surfacing as
    // "Connection terminated unexpectedly" on the client. Queries are still
    // serialized through PGlite's internal queue, so raising this is safe.
    maxConnections: 100,
  });
  await server.start();

  const dbUrl = pgliteDevDbUrl(HOST, PORT);
  log.info('PGlite socket listening', {
    host: HOST,
    port: PORT,
    dataDir,
    dbUrl,
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info('shutting down PGlite socket', { signal, dbUrl });
    await server.stop();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

await main().catch((error: unknown) => {
  assert.fail('db:pglite-socket failed', { error });
});
