// @io-wall-ok
/**
 * Local seed orchestrator. Invoked after migrate when tests boot Mockingbird Postgres.
 * Compose {@link DatabaseSeeder} units here (same pattern as migrations).
 */

import { ChessPuzzleLoadFileSeeder } from '@libs/chess-puzzle-server-ts/chess-puzzle-load-file-seeder';
import { chessPackageRootFromLoadFileModule } from '@libs/chess-puzzle-server-ts/load-file';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { ComposedDatabaseSeeder } from '@pkgs/db-migrate-shared-ts/composed-database-seeder';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-local-shared-ts/ports';
import { createPgPool } from '@pkgs/sql-client-postgres-server-ts/connect';

const fs = wallNodeFs();

export function localChessPuzzleLoadFileRoot(): string {
  return chessPackageRootFromLoadFileModule();
}

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
          rootDir: localChessPuzzleLoadFileRoot(),
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
