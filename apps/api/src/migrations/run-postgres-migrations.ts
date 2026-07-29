/**
 * Canonical Postgres migration order: ensure schema → apply idempotent
 * `schema.sql` (real tables + PowerSync publication) → kv migrate.
 */
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import { raw } from '@pkgs/sql';
import { ensurePostgresSchema } from '@pkgs/sql-client/postgres/connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { runPowerSyncSourceDbSql } from '@libs/infra/cli/resources/powersync-source-db';
import { runSchemaSql } from '@libs/db/server/run-schema-sql';

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
    // Fail fast on lock waits so callers can retry — long waits against
    // PowerSync exclusive locks otherwise stall deploys for minutes.
    // (Do not set deadlock_timeout: hosted Postgres often denies it.)
    await tx.run(raw("SET LOCAL lock_timeout = '15s'"));
    await runSchemaSql({ sqlClient: tx, logger });
    await runPowerSyncSourceDbSql({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });
}
