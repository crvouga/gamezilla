// @io-wall-ok
/**
 * Local seed orchestrator. Invoked after migrate when tests boot embedded Postgres.
 * Compose {@link DatabaseSeeder} units here (same pattern as migrations).
 */

import { ChessPuzzleLoadFileSeeder } from '@libs/chess/root/server/seed-chess-puzzles/chess-puzzle-load-file-seeder';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { wallClock } from '@pkgs/clock';
import { ComposedDatabaseSeeder } from '@pkgs/db-migrate';
import { createLogger } from '@pkgs/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

const fs = wallNodeFs();
const chessRoot = new URL('../../../libs/chess', import.meta.url).pathname;

/** `databaseUrl` defaults to the shared local cluster; a stack passes its own. */
export async function runLocalSeed(
  databaseUrl: string = LOCAL_DATABASE_URL
): Promise<void> {
  process.stdout.write(`[postgres] seed start ${databaseUrl}\n`);
  const logger = createLogger({ name: 'postgres:seed', now: wallClock.now });
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    const databaseSeeder = new ComposedDatabaseSeeder();

    databaseSeeder.register(
      new ChessPuzzleLoadFileSeeder({
        loadFileStore: createNodeFsObjectStore({
          rootDir: chessRoot,
          fs,
          layout: 'tree',
        }),
        createId: () => crypto.randomUUID(),
        now: wallClock.now,
      })
    );
    await databaseSeeder.seed({ sqlClient, logger });
  } finally {
    await pool.end();
  }
  process.stdout.write('[postgres] seed complete\n');
}

if (import.meta.main) {
  await runLocalSeed();
}
