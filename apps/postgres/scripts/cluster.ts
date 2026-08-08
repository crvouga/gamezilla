import { existsSync, mkdirSync } from 'node:fs';
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
export const DATA_DIR = join(APP_DIR, 'data');
export const DATABASE_DIR = join(DATA_DIR, 'db');

export function createEmbeddedPostgres(): EmbeddedPostgres {
  mkdirSync(DATA_DIR, { recursive: true });
  return new EmbeddedPostgres({
    databaseDir: DATABASE_DIR,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT,
    persistent: true,
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

/** True when initdb has already produced a cluster in {@link DATABASE_DIR}. */
export function clusterAlreadyInitialised(): boolean {
  return existsSync(join(DATABASE_DIR, 'PG_VERSION'));
}

export async function ensureClusterInitialised(
  pg: EmbeddedPostgres
): Promise<void> {
  if (clusterAlreadyInitialised()) {
    return;
  }
  process.stdout.write('[postgres] initialising cluster…\n');
  await pg.initialise();
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

export { LOCAL_DATABASE_URL };
