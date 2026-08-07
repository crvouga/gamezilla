/**
 * Canonical Postgres migration order: ensure schema → apply idempotent
 * `schema.sql` → kv migrate → entity_store migrate.
 */

import { runSchemaSql } from '@libs/db/server/run-schema-sql';
import { EntityStoreImplPostgres } from '@pkgs/entity-store/impl-postgres';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ensurePostgresSchema } from '@pkgs/sql-client/postgres/connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

/**
 * Session/transaction advisory lock for `api:migrate`. Serializes concurrent
 * CI jobs (check-api + check-browser) against the shared hosted dev Postgres so
 * they wait instead of thrashing on DDL `lock_timeout`. Distinct from the
 * matchmaking tick lock id.
 */
export const API_MIGRATE_ADVISORY_LOCK_ID = '872014001234567890';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  logger: Logger;
  dbScope: PostgresDbScope;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, logger, dbScope } = args;
  await ensurePostgresSchema(sqlClient, dbScope);

  await sqlClient.transaction(async (tx) => {
    // Wait unbounded for the migrate mutex (other CI migrates). DDL lock_timeout
    // is set after the advisory lock is held (see below).
    // (Do not set deadlock_timeout: hosted Postgres often denies it.)
    await tx.run(raw("SET LOCAL lock_timeout = '0'"));
    logger.info('acquiring migrate advisory lock');
    await tx.run(
      sql<void>`
        SELECT pg_advisory_xact_lock(
          ${API_MIGRATE_ADVISORY_LOCK_ID}::bigint
        ) AS locked`
    );
    logger.info('migrate advisory lock acquired');
    // Keep DDL lock waits bounded so a wedged backend fails into migrate-db
    // retries rather than hanging the job indefinitely.
    await tx.run(raw("SET LOCAL lock_timeout = '5min'"));
    await runSchemaSql({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
    await EntityStoreImplPostgres.migrateUp({ sqlClient: tx, logger });
  });
}
