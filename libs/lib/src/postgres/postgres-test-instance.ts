/**
 * Singleton Postgres instance for tests. Reuses a single container across test runs
 * within the same process. Exposes wipe() to reset the database for fast test reuse.
 */

import { SQL } from 'bun';
import { assert } from '../assert';
import type { PostgresConfig, StartedPostgres } from './postgres-container';
import { startPostgresContainer } from './postgres-container';

const WIPE_SQL = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
`.trim();

let instance: StartedPostgres | null = null;
let wipeClient: InstanceType<typeof SQL> | null = null;

export type PostgresTestInstance = {
  connectionUrl: string;
  config: StartedPostgres['config'];
  wipe: () => Promise<void>;
};

async function wipeDatabase(url: string): Promise<void> {
  try {
    if (!wipeClient) {
      wipeClient = new SQL(url);
    }
    await wipeClient.unsafe(WIPE_SQL).simple();
  } catch {
    void wipeClient?.close();
    wipeClient = null;
    wipeClient = new SQL(url);
    await wipeClient.unsafe(WIPE_SQL).simple();
  }
}

/**
 * Returns a shared Postgres test instance. Starts a container on first call,
 * reuses it on subsequent calls. Use wipe() before each test for a clean slate.
 *
 * @param config - Optional overrides (port, user, etc.). Use a unique port if
 *   running multiple test suites in parallel.
 */
export async function getPostgresTestInstance(
  config: Partial<PostgresConfig> = {}
): Promise<PostgresTestInstance> {
  if (!instance) {
    instance = await startPostgresContainer(config);
  }

  const inst = instance;
  assert.ok(inst !== null && inst !== undefined, 'instance must be set');
  return {
    connectionUrl: inst.connectionUrl,
    config: inst.config,
    wipe: async () => {
      await wipeDatabase(inst.connectionUrl);
    },
  };
}

/**
 * Stops the shared test instance and clears the singleton.
 * Call this in afterAll() if you need to release the container.
 */
export async function stopPostgresTestInstance(): Promise<void> {
  if (wipeClient) {
    void wipeClient.close();
    wipeClient = null;
  }
  if (instance) {
    await instance.stop();
    instance = null;
  }
}
