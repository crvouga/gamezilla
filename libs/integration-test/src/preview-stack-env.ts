import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';

/** Env overrides for preview/QA — uses Infisical-injected `DATABASE_URL` (dev hosted Postgres). */
export function previewStackEnv(): Record<string, string> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  assert.nonEmptyString(
    databaseUrl,
    'DATABASE_URL must be set for QA preview (run under `secrets-run` with SECRETS_ENV=dev)'
  );
  const secretsEnv = process.env['SECRETS_ENV']?.trim() ?? 'dev';
  assertDevSecretsEnv(secretsEnv);
  if (isLoopbackPostgresUrl(databaseUrl)) {
    assert.fail(
      'QA preview DATABASE_URL must not target loopback Postgres — use Infisical `dev` hosted database URL',
      { secretsEnv }
    );
  }
  return {
    DATABASE_URL: databaseUrl,
    POSTGRES_SCHEMA: process.env['POSTGRES_SCHEMA']?.trim() || 'public',
    SECRETS_ENV: secretsEnv,
  };
}
