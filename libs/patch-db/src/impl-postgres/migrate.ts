import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { MIGRATIONS } from './sql-constants';

/** Idempotent Postgres DDL for patches + snapshots (runs every time; IF NOT EXISTS). */
async function runPatchDbPostgresMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info('patch-db postgres migrate: applying ddl', {
    statementCount: statements.length,
  });
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
  log.info('patch-db postgres migrate: ddl applied');
}

/** Entry point used by {@link PatchDbImplPostgres.migrate}; wraps DDL with structured logging. */
export async function migratePatchDbPostgres(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const log = args.logger.child({ migration: 'patch-db-postgres' });
  log.info('patch-db postgres migrate: start');
  try {
    await runPatchDbPostgresMigrations(args.sqlClient, log);
    log.info('patch-db postgres migrate: complete');
  } catch (error) {
    log.error('patch-db postgres migrate: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
