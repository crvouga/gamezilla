import { assertDevVaultConfig } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';

/** Env overrides for preview/QA — uses Vault-injected `DATABASE_URL` (dev hosted Postgres). */
export function previewStackEnv(): Record<string, string> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  assert.nonEmptyString(
    databaseUrl,
    'DATABASE_URL must be set for QA preview (run under `vault run` with VAULT_CONFIG=dev)'
  );
  const vaultConfig = process.env['VAULT_CONFIG']?.trim() ?? 'dev';
  assertDevVaultConfig(vaultConfig);
  if (isLoopbackPostgresUrl(databaseUrl)) {
    assert.fail(
      'QA preview DATABASE_URL must not target loopback Postgres — use Vault `dev` hosted database URL',
      { vaultConfig }
    );
  }
  return {
    DATABASE_URL: databaseUrl,
    POSTGRES_SCHEMA: process.env['POSTGRES_SCHEMA']?.trim() || 'gamezilla',
    VAULT_CONFIG: vaultConfig,
  };
}
