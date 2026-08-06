/**
 * Wipe hosted secrets-env `dev` Postgres (DROP SCHEMA public) then remigrate.
 * No confirm flags — every guard exists only to block production.
 */
import {
  assertDevSecretsEnv,
  assertNonProdDatabaseUrl,
  normalizeDatabaseUrlForCompare,
} from '@libs/infra/shared/database-url-policy';
import { fetchSecretFrom } from '@libs/infra/cli/secrets/secrets';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { raw } from '@pkgs/sql';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';
import { join } from 'node:path';
import { runPostgresMigrations } from '../src/migrations/run-postgres-migrations';

const apiRoot = join(import.meta.dirname, '..');
const REPO_ROOT = join(apiRoot, '../..');

function resolveSecretsEnvForWipe(): string {
  const fromEnv = process.env['SECRETS_ENV']?.trim() ?? '';
  if (fromEnv.length > 0) return fromEnv;
  return resolveSecretsScope(REPO_ROOT).env;
}

function resolveDatabaseUrlForWipe(): string {
  const fromEnv = (process.env['DATABASE_URL'] ?? '').trim();
  assert.nonEmptyString(
    fromEnv,
    'db:wipe:dev requires DATABASE_URL from secrets-run (secrets env `dev`). ' +
      'Do not pass a URL on the CLI; run `bun run db:wipe:dev`.',
    { surface: 'api:wipe-dev' }
  );
  if (
    !fromEnv.startsWith('postgresql://') &&
    !fromEnv.startsWith('postgres://')
  ) {
    assert.fail(
      'db:wipe:dev: DATABASE_URL must be a postgres:// or postgresql:// wire URL',
      {
        surface: 'api:wipe-dev',
        url: normalizeDatabaseUrlForCompare(fromEnv),
      }
    );
  }
  return fromEnv;
}

/**
 * Fail-closed Tiger policy for wipe: secrets env `dev` only, refuse the
 * production escape hatch, require a live `prd` DATABASE_URL dual-fetch, then
 * run the shared non-prod URL checks.
 */
async function assertWipeDatabasePolicy(databaseUrl: string): Promise<void> {
  const secretsEnv = resolveSecretsEnvForWipe();
  assertDevSecretsEnv(secretsEnv);

  if (process.env['ALLOW_PRODUCTION_DATABASE_URL'] === '1') {
    assert.fail(
      'db:wipe:dev refuses ALLOW_PRODUCTION_DATABASE_URL=1. ' +
        'Wiping production is never allowed.',
      { surface: 'api:wipe-dev', secretsEnv }
    );
  }

  let productionUrl = '';
  try {
    productionUrl = (await fetchSecretFrom('prd', 'DATABASE_URL')).trim();
  } catch (error) {
    assert.fail(
      'db:wipe:dev requires fetching secrets env `prd` DATABASE_URL for ' +
        'dual-compare before any destructive SQL. Fetch failed.',
      { surface: 'api:wipe-dev', secretsEnv, error }
    );
  }
  assert.nonEmptyString(
    productionUrl,
    'db:wipe:dev: secrets env `prd` DATABASE_URL must be non-empty for dual-compare',
    { surface: 'api:wipe-dev', secretsEnv }
  );

  await assertNonProdDatabaseUrl(
    databaseUrl,
    { surface: 'api:wipe-dev', secretsEnv },
    { productionUrl }
  );
}

async function main(): Promise<void> {
  const log = createLogger({ name: 'api:wipe-dev' });
  const databaseUrl = resolveDatabaseUrlForWipe();
  await assertWipeDatabasePolicy(databaseUrl);

  const target = normalizeDatabaseUrlForCompare(databaseUrl);
  log.info('wiping development database', { target });
  process.stdout.write(`[api:wipe-dev] wiping ${target}\n`);

  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
  try {
    await sqlClient.run(raw('DROP SCHEMA public CASCADE'));
    await sqlClient.run(raw('CREATE SCHEMA public'));
    log.info('public schema dropped and recreated; remigrating');
    await runPostgresMigrations({ sqlClient, logger: log, dbScope });
    log.info('wipe + remigrate finished');
    process.stdout.write(
      '[api:wipe-dev] completed (schema empty + remigrated)\n'
    );
  } finally {
    await pool.end();
  }
}

await main().catch((error: unknown) => {
  assert.fail('api:wipe-dev failed', { error });
});
