import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { reconcileSnapshotIndexes } from '../indexes/reconcile';
import type { PatchDbIndexSpec } from '../indexes/index-spec';
import { postgresIndexDialect } from './index-dialect-pg';
import { MIGRATIONS } from './sql-constants';

type PgLikeError = {
  code?: string;
  message?: string;
};

function toPgLikeError(error: unknown): PgLikeError {
  if (error !== null && typeof error === 'object') return error as PgLikeError;
  return {};
}

function isIgnorableOwnershipError(error: unknown): boolean {
  const e = toPgLikeError(error);
  return (
    e.code === '42501' &&
    /must be owner of table (patches|snapshots)/i.test(e.message ?? '')
  );
}

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
    try {
      await sqlClient.run(stmt);
    } catch (error) {
      if (isIgnorableOwnershipError(error)) {
        const e = toPgLikeError(error);
        log.warn('patch-db postgres migrate: skipping ddl (non-owner)', {
          code: e.code,
          message: e.message ?? String(error),
          statement: stmt.slice(0, 80),
        });
        continue;
      }
      throw error;
    }
  }
  log.info('patch-db postgres migrate: ddl applied');
}

/** Entry point used by {@link PatchDbImplPostgres.migrate}; wraps DDL with structured logging. */
export async function migratePatchDbPostgres(args: {
  sqlClient: SqlClient;
  logger: Logger;
  /** Declarative snapshot indexes; reconciled after base DDL. */
  indexes?: readonly PatchDbIndexSpec[];
}): Promise<void> {
  const log = args.logger.child({ migration: 'patch-db-postgres' });
  log.info('patch-db postgres migrate: start');
  try {
    await runPatchDbPostgresMigrations(args.sqlClient, log);
    if (args.indexes !== undefined) {
      await reconcileSnapshotIndexes({
        sqlClient: args.sqlClient,
        logger: args.logger,
        dialect: postgresIndexDialect,
        indexes: args.indexes,
      });
    }
    log.info('patch-db postgres migrate: complete');
  } catch (error) {
    log.error('patch-db postgres migrate: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
