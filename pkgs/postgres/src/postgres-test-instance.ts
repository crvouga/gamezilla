/**
 * Singleton embedded-postgres instance for tests. Boots a real PostgreSQL
 * cluster from the bundled `embedded-postgres` binaries (no Docker, no system
 * install) in a unique temp data dir, reuses it across the test process, and
 * exposes `wipe()` to reset the application schema for fast per-test reuse.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SQL } from 'bun';
import EmbeddedPostgres from 'embedded-postgres';
import { assert } from '@pkgs/assert';
import { quotePgIdent } from '@pkgs/sql-client/postgres-schema';

export type PostgresTestConfig = {
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Application schema to reset on `wipe()` (default `test`). */
  schema?: string;
};

export type PostgresTestInstance = {
  connectionUrl: string;
  config: Required<PostgresTestConfig> & { schema: string };
  wipe: () => Promise<void>;
};

const DEFAULTS = {
  port: 25_432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  schema: 'test',
} satisfies Required<PostgresTestConfig>;

function buildWipeSql(schema: string): string {
  const ident = quotePgIdent(schema);
  return `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
DROP SCHEMA IF EXISTS ${ident} CASCADE;
CREATE SCHEMA ${ident};
GRANT ALL ON SCHEMA ${ident} TO postgres;
GRANT ALL ON SCHEMA ${ident} TO public;
`.trim();
}

type Started = {
  pg: EmbeddedPostgres;
  dataDir: string;
  connectionUrl: string;
  config: Required<PostgresTestConfig> & { schema: string };
};

let instance: Started | null = null;
let wipeClient: InstanceType<typeof SQL> | null = null;

function buildUrl(c: Required<PostgresTestConfig>): string {
  const auth = `${c.user}:${encodeURIComponent(c.password)}`;
  return `postgres://${auth}@127.0.0.1:${String(c.port)}/${c.database}?sslmode=disable`;
}

async function startEmbedded(
  config: Required<PostgresTestConfig> & { schema: string }
): Promise<Started> {
  const dataDir = mkdtempSync(join(tmpdir(), 'gz-pg-test-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: config.user,
    password: config.password,
    port: config.port,
    authMethod: 'scram-sha-256',
    // Ephemeral: stop() deletes the data dir so each process starts clean.
    persistent: false,
    postgresFlags: ['-h', '127.0.0.1', '-c', 'unix_socket_directories='],
    onLog: () => undefined,
    onError: () => undefined,
  });
  await pg.initialise();
  await pg.start();
  return { pg, dataDir, connectionUrl: buildUrl(config), config };
}

async function wipeDatabase(url: string, schema: string): Promise<void> {
  const wipeSql = buildWipeSql(schema);
  try {
    wipeClient ??= new SQL(url);
    await wipeClient.unsafe(wipeSql).simple();
  } catch {
    void wipeClient?.close();
    wipeClient = new SQL(url);
    await wipeClient.unsafe(wipeSql).simple();
  }
}

/**
 * Returns a shared embedded-postgres test instance. Boots a cluster on first
 * call, reuses it on subsequent calls. Use `wipe()` before each test for a
 * clean slate.
 *
 * @param config - Optional overrides (port, user, schema, etc.). Use a unique
 *   port if running multiple test suites in parallel.
 */
export async function getPostgresTestInstance(
  config: PostgresTestConfig = {}
): Promise<PostgresTestInstance> {
  const merged = { ...DEFAULTS, ...config };
  if (!instance) {
    instance = await startEmbedded(merged);
  }

  const inst = instance;
  assert.ok(inst !== null && inst !== undefined, 'instance must be set');
  return {
    connectionUrl: inst.connectionUrl,
    config: inst.config,
    wipe: async () => {
      await wipeDatabase(inst.connectionUrl, inst.config.schema);
    },
  };
}

/**
 * Stops the shared test instance and clears the singleton. `persistent: false`
 * means `stop()` deletes the data dir; the explicit `rmSync` is a no-op safety
 * net if shutdown raced.
 */
export async function stopPostgresTestInstance(): Promise<void> {
  if (wipeClient) {
    void wipeClient.close();
    wipeClient = null;
  }
  if (instance) {
    const { pg, dataDir } = instance;
    instance = null;
    await pg.stop();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Best-effort; stop() already removed it for non-persistent clusters.
    }
  }
}
