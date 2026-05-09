/**
 * Canonical Postgres migration order: patch-db → kv → Better Auth (Kysely).
 *
 * Better Auth DDL runs after the transaction. Kysely owns its own short-lived
 * pool (created from `databaseUrl`) so `kysely.destroy()` cannot end a pool
 * the caller still owns — `pg.Pool.end()` throws on a second call.
 */
import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  databaseUrl: string;
  logger: Logger;
  betterAuthOptions: Omit<BetterAuthOptions, 'database'>;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, databaseUrl, logger, betterAuthOptions } = args;
  await sqlClient.transaction(async (tx) => {
    await PatchDbImplPostgres.migrateUp({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });

  const kyselyPool = new Pool({ connectionString: databaseUrl });
  const kysely = new Kysely({
    dialect: new PostgresDialect({ pool: kyselyPool }),
  });
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
