/**
 * Canonical Postgres migration order: ensure schema → framework DDL →
 * domain reconcile → kv migrate → entity_store migrate.
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { postgres } from '@pkgs/db-schema/postgres';
import { EntityStoreImplPostgres } from '@pkgs/entity-store/impl-postgres';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { ensurePostgresSchema } from '@pkgs/sql-client/postgres/connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { applyFrameworkServerDdl } from '@pkgs/sync-engine/shared';

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

function asPostgresClient(
  client: SqlClient,
  dbScope: PostgresDbScope
): PostgresSqlClient {
  return Object.assign(client, { dbScope });
}

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
    await applyFrameworkServerDdl({ sqlClient: tx, logger });
    await postgres(appSchema, asPostgresClient(tx, dbScope), {
      skipAdvisoryLock: true,
      alreadyInTransaction: true,
    }).reconcile();
    logger.info('domain schema reconciled');
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
    await EntityStoreImplPostgres.migrateUp({ sqlClient: tx, logger });
  });
}
