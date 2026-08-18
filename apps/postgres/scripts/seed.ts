// @io-wall-ok
/**
 * Local-dev seed orchestrator. Invoked after migrate on `@apps/postgres` boot.
 * Compose {@link DatabaseSeeder} units here (same pattern as migrations).
 */
import { ChessPuzzleLoadFileSeeder } from '@libs/chess/root/server/seed-chess-puzzles/chess-puzzle-load-file-seeder';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { ComposedDatabaseSeeder } from '@pkgs/db-migrate';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';
import { LOCAL_DATABASE_URL } from './ports';

const io = wallIo();
const fs = wallNodeFs();
const chessRoot = new URL('../../../libs/chess', import.meta.url).pathname;

export async function runLocalSeed(): Promise<void> {
  process.stdout.write(`[postgres] seed start ${LOCAL_DATABASE_URL}\n`);
  const logger = createLogger({ name: 'postgres:seed', now: io.clock.now });
  const { pool, sqlClient } = createPgPool({
    connectionString: LOCAL_DATABASE_URL,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    const databaseSeeder = new ComposedDatabaseSeeder().register(
      new ChessPuzzleLoadFileSeeder({
        loadFileStore: createNodeFsObjectStore({
          rootDir: chessRoot,
          fs,
          layout: 'tree',
        }),
        createId: io.createId,
        now: io.clock.now,
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
