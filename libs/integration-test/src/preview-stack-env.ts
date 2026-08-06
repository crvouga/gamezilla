import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres/connect';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-api-preview';

/**
 * Env overrides for local/CI check preview stacks. Pins the client export to
 * wrangler on :8788 — secrets-run may inject production `EXPO_PUBLIC_API_URL`,
 * which would bake into `expo export` and leave the SPA calling api.gamezilla.app
 * (auth never binds → infinite boot spinner).
 */
export function previewStackEnv(): Record<string, string> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  assert.nonEmptyString(
    databaseUrl,
    'DATABASE_URL must be set for check preview (run under `secrets-run` with SECRETS_ENV=dev)'
  );
  const secretsEnv = process.env['SECRETS_ENV']?.trim() ?? 'dev';
  assertDevSecretsEnv(secretsEnv);
  if (isLoopbackPostgresUrl(databaseUrl)) {
    assert.fail(
      'Check preview DATABASE_URL must not target loopback Postgres — use secrets env `dev` hosted database URL',
      { secretsEnv }
    );
  }
  return {
    DATABASE_URL: databaseUrl,
    POSTGRES_SCHEMA: process.env['POSTGRES_SCHEMA']?.trim() || 'public',
    SECRETS_ENV: secretsEnv,
    API_URL: DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
    EXPO_PUBLIC_API_URL: DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
    EXPO_PUBLIC_E2E: '1',
  };
}
