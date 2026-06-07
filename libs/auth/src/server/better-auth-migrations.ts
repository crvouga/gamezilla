/**
 * Better Auth Postgres migrations runner.
 *
 * Owns its own short-lived Kysely pool (created from `databaseUrl`) so
 * `kysely.destroy()` cannot end a pool the caller still owns —
 * `pg.Pool.end()` throws on a second call.
 */
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Kysely, PostgresDialect } from 'kysely';

export type BetterAuthMigrationOptions = Omit<BetterAuthOptions, 'database'>;

export type RunBetterAuthMigrationsArgs = {
  databaseUrl: string;
  betterAuthOptions: BetterAuthMigrationOptions;
  dbScope: PostgresDbScope;
};

export async function runBetterAuthMigrations(
  args: RunBetterAuthMigrationsArgs
): Promise<void> {
  const { databaseUrl, betterAuthOptions, dbScope } = args;
  const { pool: kyselyPool } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
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
