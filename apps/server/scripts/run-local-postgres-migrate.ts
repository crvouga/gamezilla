// @io-wall-ok
/**
 * Run definitive `@libs/runtime` Postgres migrations against the local embedded
 * DATABASE_URL (in-process — apps must not import other `@apps/*` packages).
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import { PostgresMigrationRunner } from '@libs/runtime/server/run-postgres-migrations';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

/** `databaseUrl` defaults to the shared local cluster; a stack passes its own. */
export async function runLocalMigrate(
  databaseUrl: string = LOCAL_DATABASE_URL
): Promise<void> {
  process.stdout.write('[postgres] migrating…\n');
  const dbScope = appPostgresDbScope();
  const logger = createLogger({
    name: 'postgres:migrate',
    now: wallClock.now,
  });
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
  try {
    await new PostgresMigrationRunner({
      sqlClient,
      logger,
      dbScope,
      clock: wallClock,
    }).run();
  } finally {
    await pool.end();
  }
  process.stdout.write('[postgres] migrate complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
