/**
 * Better Auth Postgres migrations runner.
 *
 * Owns its own short-lived Kysely pool (created from `databaseUrl`) so
 * `kysely.destroy()` cannot end a pool the caller still owns —
 * `pg.Pool.end()` throws on a second call.
 */
import { sanitizePostgresUrlForNodePg } from '@gamezilla/sql-client/sanitize-postgres-url-for-node-pg';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export type BetterAuthMigrationOptions = Omit<BetterAuthOptions, 'database'>;

export type RunBetterAuthMigrationsArgs = {
  databaseUrl: string;
  betterAuthOptions: BetterAuthMigrationOptions;
};

export async function runBetterAuthMigrations(
  args: RunBetterAuthMigrationsArgs
): Promise<void> {
  const { databaseUrl, betterAuthOptions } = args;
  const kyselyPool = new Pool({
    connectionString: sanitizePostgresUrlForNodePg(databaseUrl),
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
