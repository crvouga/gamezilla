/**
 * Canonical Postgres migration order: patch-db → kv → Better Auth (Kysely).
 *
 * Better Auth DDL runs after the transaction so `getMigrations` uses the same
 * pool (introspection + `CREATE TABLE` share one connection pool).
 */
import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  pool: Pool;
  logger: Logger;
  betterAuthOptions: Omit<BetterAuthOptions, 'database'>;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, pool, logger, betterAuthOptions } = args;
  await sqlClient.transaction(async (tx) => {
    await PatchDbImplPostgres.migrateUp({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });

  const kysely = new Kysely({ dialect: new PostgresDialect({ pool }) });
  try {
    const { runMigrations } = await getMigrations({
      ...betterAuthOptions,
      database: { db: kysely, type: 'postgres' },
    });
    await runMigrations();
  } finally {
    await kysely.destroy();
  }
}
