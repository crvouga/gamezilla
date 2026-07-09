/**
 * Canonical Postgres migration order: ensure schema → apply idempotent
 * `schema.sql` (real tables + PowerSync publication) → kv migrate.
 */
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import { ensurePostgresSchema } from '@pkgs/sql-client/postgres-connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { dropLegacyAuthTables } from './drop-legacy-auth-tables';
import { runMigrateGamezillaToPublicSql } from './run-migrate-gamezilla-to-public';
import { runPowerSyncSourceDbSql } from '@libs/infra/cli/resources/powersync-source-db';
import { runSchemaSql } from './run-schema-sql';

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
  await dropLegacyAuthTables(sqlClient, logger);

  await sqlClient.transaction(async (tx) => {
    await runMigrateGamezillaToPublicSql({ sqlClient: tx, logger });
    await runSchemaSql({ sqlClient: tx, logger });
    await runPowerSyncSourceDbSql({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });
}
