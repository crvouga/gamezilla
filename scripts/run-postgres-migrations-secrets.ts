/**
 * Postgres migrations using secret-store `DATABASE_URL` (ignores stale `.dev.vars`).
 * Used by PowerSync setup/deploy so schema + publication target the same DB.
 */
import { createLogger } from '@pkgs/logger';
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { resolveDatabaseUrl } from '../libs/infra/src/cli/resources/postgres';
import { loadSecretsIntoEnv } from '../libs/infra/src/cli/secrets/secrets';
import { runPostgresMigrations } from '../apps/api/src/migrations/run-postgres-migrations';

export async function runPostgresMigrationsFromSecrets(): Promise<void> {
  await loadSecretsIntoEnv();
  const databaseUrl = await resolveDatabaseUrl();
  const dbScope = appPostgresDbScope();
  const logger = createLogger({ name: 'postgres:migrate-secrets' });
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
  try {
    await runPostgresMigrations({ sqlClient, logger, dbScope });
    process.stdout.write(
      '[postgres:migrate-secrets] schema + powersync publication OK\n'
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  await runPostgresMigrationsFromSecrets();
}
