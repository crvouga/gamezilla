/**
 * Local-dev seed orchestrator. Invoked after migrate on `@apps/postgres` boot.
 * Compose {@link DatabaseSeeder} units here (same pattern as migrations).
 */
import { ChessPuzzleLoadFileSeeder } from '@libs/chess/server/seed-chess-puzzle/chess-puzzle-load-file-seeder';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { ComposedDatabaseSeeder } from '@pkgs/db-migrate';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';
import { LOCAL_DATABASE_URL } from './ports';

const io = wallIo();

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
      new ChessPuzzleLoadFileSeeder()
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
