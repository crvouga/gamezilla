/**
 * Run definitive `@libs/db` Postgres migrations against the local embedded
 * DATABASE_URL (in-process — apps must not import other `@apps/*` packages).
 */
import { runPostgresMigrations } from '@libs/db/server/run-postgres-migrations';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { createLogger } from '@pkgs/logger';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';
import { LOCAL_DATABASE_URL } from './ports';

/** Schema migrate only — Better Auth DDL does not call this origin. */
const BETTER_AUTH_MIGRATE_BASE_URL = 'https://migrate.local';

async function resolveBetterAuthMigrateSecret(): Promise<string> {
  const fromEnv = process.env['BETTER_AUTH_SECRET']?.trim() ?? '';
  if (fromEnv.length >= 32) return fromEnv;
  const store = createScriptSecretStore();
  return (await store.getRequired('BETTER_AUTH_SECRET')).readSecretValue();
}

export async function runLocalMigrate(): Promise<void> {
  process.stdout.write('[postgres] migrating…\n');
  const betterAuthSecret = await resolveBetterAuthMigrateSecret();
  const dbScope = appPostgresDbScope();
  const logger = createLogger({ name: 'postgres:migrate' });
  const { pool, sqlClient } = createPgPool({
    connectionString: LOCAL_DATABASE_URL,
    dbScope,
    max: 1,
  });
  try {
    await runPostgresMigrations({
      sqlClient,
      pool,
      logger,
      dbScope,
      betterAuthSecret,
      betterAuthBaseURL: BETTER_AUTH_MIGRATE_BASE_URL,
    });
  } finally {
    await pool.end();
  }
  process.stdout.write('[postgres] migrate complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
