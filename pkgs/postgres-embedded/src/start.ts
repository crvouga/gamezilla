// @io-wall-ok
import {
  type ClusterConfig,
  clusterUrl,
  createEmbeddedPostgres,
  defaultClusterConfig,
  ensureAppDatabase,
  ensureClusterInitialised,
  formatUnknownError,
  wipeClusterData,
} from './cluster';

export type EmbeddedPostgresHandle = {
  readonly url: string;
  readonly port: number;
  readonly dataDir: string;
  stop(): Promise<void>;
};

export type StartEmbeddedPostgresOptions = {
  /** Listen port. Defaults to the shared local port. */
  readonly port?: number;
  /** Cluster directory. A distinct directory means a distinct database. */
  readonly dataDir?: string;
};

/**
 * Start embedded Postgres (no product migrate/seed). Caller migrates.
 *
 * Port and data directory are parameters, so several clusters can run at once.
 */
export async function startEmbeddedPostgres(
  options?: StartEmbeddedPostgresOptions
): Promise<EmbeddedPostgresHandle> {
  const defaults = defaultClusterConfig();
  const config: ClusterConfig = {
    port: options?.port ?? defaults.port,
    dataDir: options?.dataDir ?? defaults.dataDir,
  };
  let pg = createEmbeddedPostgres(config);
  let stopped = false;

  async function startCluster(): Promise<void> {
    await ensureClusterInitialised(pg, config);
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
      wipeClusterData(config);
      pg = createEmbeddedPostgres(config);
      await ensureClusterInitialised(pg, config);
      await pg.start();
    }
  }

  await startCluster();
  await ensureAppDatabase(pg);
  process.stdout.write(
    `[postgres] listening postgresql://127.0.0.1:${String(config.port)}/…\n`
  );

  return {
    url: clusterUrl(config),
    port: config.port,
    dataDir: config.dataDir,
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
