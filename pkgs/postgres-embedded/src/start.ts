// @io-wall-ok
import {
  createEmbeddedPostgres,
  ensureAppDatabase,
  ensureClusterInitialised,
  ensureDatabase,
  formatUnknownError,
  LOCAL_DATABASE_URL,
  wipeClusterData,
} from './cluster';
import { localDatabaseUrl, POSTGRES_PORT } from './ports';

export type EmbeddedPostgresHandle = {
  readonly url: typeof LOCAL_DATABASE_URL;
  readonly port: number;
  /** Create `name` on this cluster when missing; returns its wire URL. */
  ensureDatabase(name: string): Promise<string>;
  stop(): Promise<void>;
};

/**
 * Start embedded Postgres (no product migrate/seed). Caller migrates.
 */
export async function startEmbeddedPostgres(): Promise<EmbeddedPostgresHandle> {
  let pg = createEmbeddedPostgres();
  let stopped = false;

  async function startCluster(): Promise<void> {
    await ensureClusterInitialised(pg);
    try {
      await pg.start();
    } catch (error) {
      if (!isRecoverableStartError(error)) throw error;
      process.stderr.write(
        `[postgres] start failed (${formatUnknownError(error)}); reinitialising cluster…\n`
      );
      try {
        await pg.stop();
      } catch {
        // already down
      }
      wipeClusterData();
      pg = createEmbeddedPostgres();
      await ensureClusterInitialised(pg);
      await pg.start();
    }
  }

  await startCluster();
  await ensureAppDatabase(pg);
  process.stdout.write(
    `[postgres] listening postgresql://127.0.0.1:${String(POSTGRES_PORT)}/…\n`
  );

  return {
    url: LOCAL_DATABASE_URL,
    port: POSTGRES_PORT,
    async ensureDatabase(name) {
      await ensureDatabase(pg, name);
      return localDatabaseUrl(name);
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await pg.stop();
    },
  };
}

function isRecoverableStartError(error: unknown): boolean {
  if (error === undefined || error === null) return true;
  const message = formatUnknownError(error);
  if (message.length === 0 || message === 'undefined' || message === '{}') {
    return true;
  }
  return (
    /pg_notify/i.test(message) ||
    /could not open directory/i.test(message) ||
    /database files are incompatible/i.test(message)
  );
}
