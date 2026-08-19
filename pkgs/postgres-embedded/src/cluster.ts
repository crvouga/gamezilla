// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  LOCAL_DATABASE_URL,
  POSTGRES_DATABASE,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_USER,
} from './ports';

export const APP_DIR = join(import.meta.dirname, '..');

export function resolveDataDir(): string {
  const fromEnv = process.env['POSTGRES_EMBEDDED_DATA_DIR']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return join(APP_DIR, 'data');
}

export const DATA_DIR = resolveDataDir();
export const DATABASE_DIR = join(DATA_DIR, 'db');

/** Subdirs every initdb cluster must have (detect interrupted / wiped clusters). */
const REQUIRED_CLUSTER_DIRS = [
  'base',
  'global',
  'pg_notify',
  'pg_tblspc',
  'pg_wal',
  'pg_xact',
] as const;

export function createEmbeddedPostgres(): EmbeddedPostgres {
  mkdirSync(DATA_DIR, { recursive: true });
  return new EmbeddedPostgres({
    databaseDir: DATABASE_DIR,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT,
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

/** True when initdb has produced a usable cluster under {@link DATABASE_DIR}. */
export function clusterLooksHealthy(): boolean {
  if (!existsSync(join(DATABASE_DIR, 'PG_VERSION'))) return false;
  for (const dir of REQUIRED_CLUSTER_DIRS) {
    if (!existsSync(join(DATABASE_DIR, dir))) return false;
  }
  return true;
}

/** @deprecated use {@link clusterLooksHealthy} */
export function clusterAlreadyInitialised(): boolean {
  return clusterLooksHealthy();
}

export function wipeClusterData(): void {
  if (!existsSync(DATABASE_DIR)) return;
  process.stdout.write(
    `[postgres] wiping incomplete cluster at ${DATABASE_DIR}\n`
  );
  rmSync(DATABASE_DIR, { recursive: true, force: true });
}

/**
 * Ensure a healthy cluster exists. Wipes and re-runs initdb when PG_VERSION
 * is present but required dirs (e.g. pg_notify) are missing — common after a
 * crashed first boot or partial data wipe.
 */
export async function ensureClusterInitialised(
  pg: EmbeddedPostgres
): Promise<void> {
  if (clusterLooksHealthy()) {
    return;
  }
  if (existsSync(join(DATABASE_DIR, 'PG_VERSION'))) {
    wipeClusterData();
  }
  process.stdout.write('[postgres] initialising cluster…\n');
  await pg.initialise();
  if (!clusterLooksHealthy()) {
    throw new Error(
      `[postgres] initdb finished but cluster is still incomplete under ${DATABASE_DIR}`
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

export { LOCAL_DATABASE_URL };
