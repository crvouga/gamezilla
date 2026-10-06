// @io-wall-ok
/**
 * Reconcile `@libs/runtime` Postgres schemas against the local embedded
 * DATABASE_URL (in-process — apps must not import other `@apps/*` packages).
 */

import { appPostgresDbScope } from '@libs/db-shared/scope';
import { reconcilePostgres } from '@libs/runtime-server/reconcile-postgres';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createLogger } from '@pkgs/logger-shared/logger';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-local-shared/ports';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';

/** `databaseUrl` defaults to the shared local cluster; a stack passes its own. */
export async function runLocalMigrate(
  databaseUrl: string = LOCAL_DATABASE_URL
): Promise<void> {
  process.stdout.write('[postgres] reconciling…\n');
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
    await reconcilePostgres({
      sqlClient,
      logger,
      dbScope,
      clock: wallClock,
    });
  } finally {
    await pool.end();
  }
  process.stdout.write('[postgres] reconcile complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
