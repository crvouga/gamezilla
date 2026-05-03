import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  MIGRATIONS,
  POSTGRES_DROP_REPLICA_EPOCH_TABLES,
} from './sql-constants';

/** Idempotent Postgres DDL for patches + snapshots. */
async function runPatchDbPostgresMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const existing = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('patches', 'snapshots')`
  );
  if (existing.length >= 2) {
    log.info('patch-db postgres migrate: core tables already exist', {
      existingTables: existing.map((r) => r.tablename),
    });
    await dropRemovedReplicaEpochTables(sqlClient, log);
    return;
  }

  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info('patch-db postgres migrate: applying ddl', {
    statementCount: statements.length,
    existingTableCount: existing.length,
  });
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
  log.info('patch-db postgres migrate: ddl applied');
  await dropRemovedReplicaEpochTables(sqlClient, log);
}

async function dropRemovedReplicaEpochTables(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const stmts = POSTGRES_DROP_REPLICA_EPOCH_TABLES.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of stmts) {
    await sqlClient.run(stmt);
  }
  log.info(
    'patch-db postgres migrate: dropped legacy replica-epoch tables if present'
  );
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
