// @io-wall-ok
/**
 * Wipe a non-production environment's Postgres (DROP SCHEMA public) then
 * remigrate (`bun run db:wipe:dev` targets `dev`).
 * Prefers `.dev.vars` (loopback Mockingbird Postgres) then secrets-run env.
 * No confirm flags — every guard exists only to block production.
 */

import { join } from 'node:path';
import { readDevVarsDatabaseUrl } from '@libs/db-server/dev-vars';
import { fetchSecretFrom } from '@libs/db-server/secret-io';
import { assertNonProdDatabaseUrl } from '@libs/db-shared/database-url-policy';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { PRODUCTION_ENV_NAMES } from '@libs/infra-shared/envs';
import { reconcilePostgres } from '@libs/runtime-server/reconcile-postgres';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { wallClock } from '@pkgs/clock-shared/wall';
import {
  assertNonProductionSecretsEnv,
  normalizeDatabaseUrlForCompare,
} from '@pkgs/database-url-policy-shared/database-url-policy';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import { raw } from '@pkgs/sql-root-shared/sql';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const configStore = createRepoTreeObjectStore({ rootDir: REPO_ROOT });

async function resolveSecretsEnvForWipe(): Promise<string> {
  const fromEnv = process.env['SECRETS_ENV']?.trim() ?? '';
  if (fromEnv.length > 0) return fromEnv;
  return (await resolveSecretsScope(configStore)).env;
}

function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function resolveDatabaseUrlForWipe(): string {
  const fromDevVars = readDevVarsDatabaseUrl();
  if (fromDevVars !== null && isPostgresUrl(fromDevVars)) {
    return fromDevVars;
  }
  const fromEnv = (process.env['DATABASE_URL'] ?? '').trim();
  assert.nonEmptyString(
    fromEnv,
    'db:wipe:dev requires DATABASE_URL from `.dev.vars` or secrets-run ' +
      '(secrets env `dev`). Run `bun run db:wipe:dev` after setup.',
    { surface: 'api:wipe-dev' }
  );
  if (!isPostgresUrl(fromEnv)) {
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
 * Live `DATABASE_URL` of every production environment. Fail-closed: a wipe
 * never runs without comparing against all of them.
 */
async function fetchProductionDatabaseUrls(
  secretsEnv: string
): Promise<readonly string[]> {
  const urls: string[] = [];
  for (const env of PRODUCTION_ENV_NAMES) {
    let url = '';
    try {
      url = (await fetchSecretFrom(env, 'DATABASE_URL')).trim();
    } catch (error) {
      assert.fail(
        `db:wipe:dev requires fetching secrets env \`${env}\` DATABASE_URL for ` +
          'dual-compare before any destructive SQL. Fetch failed.',
        { surface: 'api:wipe-dev', secretsEnv, error }
      );
    }
    assert.nonEmptyString(
      url,
      `db:wipe:dev: secrets env \`${env}\` DATABASE_URL must be non-empty for dual-compare`,
      { surface: 'api:wipe-dev', secretsEnv }
    );
    urls.push(url);
  }
  return urls;
}

/**
 * Fail-closed Tiger policy for wipe: a non-production secrets env only,
 * refuse the production escape hatch, require a live dual-fetch of every
 * production DATABASE_URL, then run the shared non-prod URL checks.
 */
async function assertWipeDatabasePolicy(databaseUrl: string): Promise<void> {
  const secretsEnv = await resolveSecretsEnvForWipe();
  assertNonProductionSecretsEnv(secretsEnv, PRODUCTION_ENV_NAMES);

  if (process.env['ALLOW_PRODUCTION_DATABASE_URL'] === '1') {
    assert.fail(
      'db:wipe:dev refuses ALLOW_PRODUCTION_DATABASE_URL=1. ' +
        'Wiping production is never allowed.',
      { surface: 'api:wipe-dev', secretsEnv }
    );
  }

  await assertNonProdDatabaseUrl(
    databaseUrl,
    { surface: 'api:wipe-dev', secretsEnv },
    { productionUrls: await fetchProductionDatabaseUrls(secretsEnv) }
  );
}

async function main(): Promise<void> {
  const log = createLogger({ name: 'api:wipe-dev', now: wallClock.now });
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
    log.info('public schema dropped and recreated; reconciling');
    await reconcilePostgres({
      sqlClient,
      logger: log,
      dbScope,
      clock: wallClock,
    });
    log.info('wipe + reconcile finished');
    process.stdout.write(
      '[api:wipe-dev] completed (schema empty + reconciled)\n'
    );
  } finally {
    await pool.end();
  }
}

await main().catch((error: unknown) => {
  assert.fail('api:wipe-dev failed', { error });
});
