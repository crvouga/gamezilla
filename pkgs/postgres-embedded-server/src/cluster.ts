import { join } from 'node:path';
import { wallOsFs } from '@pkgs/os-server/wall-os-fs';
import {
  databaseUrlFor,
  POSTGRES_DATABASE,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_USER,
} from '@pkgs/postgres-embedded-shared/ports';
import EmbeddedPostgres from 'embedded-postgres';

const osFs = wallOsFs();

export const APP_DIR = join(import.meta.dirname, '..');

/**
 * One cluster on disk. Port and directory are parameters so several clusters
 * can run side by side — that is what lets two full local stacks exist at
 * once without either knowing about the other.
 */
export type ClusterConfig = {
  readonly port: number;
  readonly dataDir: string;
};

export function resolveDataDir(): string {
  const fromEnv = process.env['POSTGRES_EMBEDDED_DATA_DIR']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return join(APP_DIR, 'data');
}

export function defaultClusterConfig(): ClusterConfig {
  return { port: POSTGRES_PORT, dataDir: resolveDataDir() };
}

export function clusterUrl(config: ClusterConfig): string {
  return databaseUrlFor(config.port);
}

export function databaseDir(config: ClusterConfig): string {
  return join(config.dataDir, 'db');
}

/** Subdirs every initdb cluster must have (detect interrupted / wiped clusters). */
const REQUIRED_CLUSTER_DIRS = [
  'base',
  'global',
  'pg_notify',
  'pg_tblspc',
  'pg_wal',
  'pg_xact',
] as const;

export function createEmbeddedPostgres(
  config: ClusterConfig = defaultClusterConfig()
): EmbeddedPostgres {
  osFs.mkdirpSync(config.dataDir);
  return new EmbeddedPostgres({
    databaseDir: databaseDir(config),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port: config.port,
    persistent: true,
    // Wrangler HMR used to orphan per-request TCP clients up to the default
    // max_connections=100. Shared loopback pool + higher ceiling + idle reclaim.
    postgresFlags: [
      '-c',
      'max_connections=400',
      '-c',
      'idle_session_timeout=60s',
    ],
    onLog: (message) => {
      process.stdout.write(`[postgres] ${String(message)}`);
      if (!String(message).endsWith('\n')) {
        process.stdout.write('\n');
      }
    },
    onError: (messageOrError) => {
      const text =
        messageOrError instanceof Error
          ? messageOrError.message
          : String(messageOrError);
      process.stderr.write(`[postgres] ${text}`);
      if (!text.endsWith('\n')) {
        process.stderr.write('\n');
      }
    },
  });
}

/** True when initdb has produced a usable cluster. */
export function clusterLooksHealthy(
  config: ClusterConfig = defaultClusterConfig()
): boolean {
  const dir = databaseDir(config);
  if (!osFs.pathExists(join(dir, 'PG_VERSION'))) return false;
  for (const required of REQUIRED_CLUSTER_DIRS) {
    if (!osFs.pathExists(join(dir, required))) return false;
  }
  return true;
}

export function wipeClusterData(
  config: ClusterConfig = defaultClusterConfig()
): void {
  const dir = databaseDir(config);
  if (!osFs.pathExists(dir)) return;
  process.stdout.write(`[postgres] wiping incomplete cluster at ${dir}\n`);
  osFs.rmrfSync(dir);
}

/**
 * Ensure a healthy cluster exists. Wipes and re-runs initdb when PG_VERSION
 * is present but required dirs (e.g. pg_notify) are missing — common after a
 * crashed first boot or partial data wipe.
 */
export async function ensureClusterInitialised(
  pg: EmbeddedPostgres,
  config: ClusterConfig = defaultClusterConfig()
): Promise<void> {
  if (clusterLooksHealthy(config)) return;
  const dir = databaseDir(config);
  if (osFs.pathExists(join(dir, 'PG_VERSION'))) {
    wipeClusterData(config);
  }
  process.stdout.write('[postgres] initialising cluster…\n');
  await pg.initialise();
  if (!clusterLooksHealthy(config)) {
    throw new Error(
      `[postgres] initdb finished but cluster is still incomplete under ${dir}`
    );
  }
}

export async function ensureAppDatabase(pg: EmbeddedPostgres): Promise<void> {
  try {
    await pg.createDatabase(POSTGRES_DATABASE);
    process.stdout.write(`[postgres] created database ${POSTGRES_DATABASE}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /already exists/i.test(message) ||
      /duplicate/i.test(message) ||
      /exists/i.test(message)
    ) {
      return;
    }
    throw error;
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : error.name;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
