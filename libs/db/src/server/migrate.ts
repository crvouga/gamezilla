// @api-wall-ok
// @io-wall-ok
/**
 * Programmatic app Postgres migrate orchestration — owned by `@libs/db`.
 * Compose site is `@libs/runtime/server/run-postgres-migrations`. Same-package
 * callers (api preview/dev) import this in-process. Root `db:migrate` / infra
 * shell out to `@libs/db` `migrate-cli.ts`. Tests/CI boot `@pkgs/postgres-embedded`
 */

import { join } from 'node:path';
import {
  assertDevSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
} from '@libs/db/public/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/db/public/database-url-policy-tooling';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { PostgresMigrationRunner } from '@libs/runtime/server/run-postgres-migrations';
import { assert } from '@pkgs/assert';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createLogger, type Logger } from '@pkgs/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { createPgPool, pingPostgres } from '@pkgs/sql-client/postgres/connect';
import { readDevVarsDatabaseUrl } from '../scripts/dev-vars';
import { fetchSecret } from '../shared/secret-io';
import {
  isPostgresTransientMigrateError,
  transientMigrateRetryReason,
} from './migrate-transient-errors';

const REPO_ROOT = join(import.meta.dirname, '../../../..');
const configStore = createRepoTreeObjectStore({ rootDir: REPO_ROOT });
/** Composition root: migrate CLI / in-process migrate owns wall I/O. */
const now = wallClock.now;
const timers = wallTimers;

/** Concurrent migrates serialize via advisory lock; these cover contention. */
const MIGRATE_RETRY_DELAYS_MS = [
  0, 3_000, 8_000, 15_000, 30_000, 60_000, 90_000, 120_000,
] as const;
const WAIT_FOR_POSTGRES_MS = 60_000;
const WAIT_FOR_POSTGRES_RETRY_MS = 1_000;

export type MigratePostgresAppOptions = {
  /** Wait until DATABASE_URL accepts connections (local embedded boot). */
  readonly wait?: boolean;
  /** Override URL resolution (env → Infisical dev → `.dev.vars`). */
  readonly databaseUrl?: string;
};

function preferLocalSecretsOnly(): boolean {
  const raw = process.env['LOCAL_SECRETS']?.trim().toLowerCase() ?? '';
  return raw === '1' || raw === 'true';
}

function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => timers.setTimeout(resolve, ms));
}

async function resolveSecretsEnvForMigrate(): Promise<string> {
  const fromEnv = process.env['SECRETS_ENV']?.trim() ?? '';
  if (fromEnv.length > 0) return fromEnv;
  return (await resolveSecretsScope(configStore)).env;
}

async function resolveDatabaseUrlForMigrate(
  override: string | undefined
): Promise<string> {
  const fromOverride = override?.trim() ?? '';
  if (fromOverride.length > 0 && isPostgresUrl(fromOverride)) {
    return fromOverride;
  }
  const fromEnv = (process.env['DATABASE_URL'] ?? '').trim();
  if (fromEnv.length > 0 && isPostgresUrl(fromEnv)) {
    return fromEnv;
  }
  if (!preferLocalSecretsOnly()) {
    try {
      const fromSecrets = (await fetchSecret('DATABASE_URL')).trim();
      if (fromSecrets.length > 0 && isPostgresUrl(fromSecrets)) {
        return fromSecrets;
      }
    } catch {
      // Infisical unavailable — fall through to local `.dev.vars`.
    }
  }
  const fromDevVars = readDevVarsDatabaseUrl();
  if (fromDevVars !== null && isPostgresUrl(fromDevVars)) {
    return fromDevVars;
  }
  const store = createScriptSecretStore();
  return (await store.getRequired('DATABASE_URL')).readSecretValue();
}

async function assertMigrateDatabasePolicy(databaseUrl: string): Promise<void> {
  const secretsEnv = await resolveSecretsEnvForMigrate();
  if (secretsEnv !== DEVELOPMENT_SECRETS_ENV) {
    return;
  }
  assertDevSecretsEnv(secretsEnv);
  await assertNonProdDatabaseUrlForTooling(databaseUrl, {
    surface: 'api:db:migrate',
    secretsEnv,
  });
}

async function waitForPostgresReachable(
  databaseUrl: string,
  log: Logger
): Promise<void> {
  const started = now();
  let attempt = 0;
  let lastError: unknown = null;

  while (now() - started < WAIT_FOR_POSTGRES_MS) {
    attempt += 1;
    try {
      await pingPostgres(databaseUrl, timers);
      if (attempt > 1) {
        log.info('postgres reachable for migrate', {
          attempt,
          elapsedMs: now() - started,
        });
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 1 || attempt % 5 === 0) {
        log.info('waiting for postgres before migrate', {
          attempt,
          elapsedMs: now() - started,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(WAIT_FOR_POSTGRES_RETRY_MS);
    }
  }

  assert.fail('postgres did not become reachable before migrate', {
    timeoutMs: WAIT_FOR_POSTGRES_MS,
    lastError:
      lastError instanceof Error ? lastError.message : String(lastError),
  });
}

async function runMigrateOnce(databaseUrl: string): Promise<void> {
  await assertMigrateDatabasePolicy(databaseUrl);
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
  const log = createLogger({ name: 'api:db:migrate', now });
  try {
    await new PostgresMigrationRunner({
      sqlClient,
      logger: log,
      dbScope,
      clock: wallClock,
    }).run();
    log.info(
      'postgres migrations finished (schema + kv + IdP; matchmaking self-migrates on first request)'
    );
    process.stdout.write(
      '[api:db:migrate] completed (schema + kv + IdP; matchmaking self-migrates on first request)\n'
    );
  } finally {
    await pool.end();
  }
}

/**
 * Run the composed app migrations against the resolved (or overridden) URL.
 */
export async function migratePostgresApp(
  options: MigratePostgresAppOptions = {}
): Promise<void> {
  const log = createLogger({ name: 'api:db:migrate', now });
  const databaseUrl = await resolveDatabaseUrlForMigrate(options.databaseUrl);
  if (options.wait) {
    await assertMigrateDatabasePolicy(databaseUrl);
    await waitForPostgresReachable(databaseUrl, log);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MIGRATE_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = MIGRATE_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delayMs > 0) {
      log.warn(
        `Postgres ${transientMigrateRetryReason(lastError)} — retrying migrate`,
        { attempt: attempt + 1, delayMs }
      );
      await sleep(delayMs);
    }
    try {
      await runMigrateOnce(databaseUrl);
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isPostgresTransientMigrateError(error)) {
        throw error;
      }
    }
  }

  assert.fail('api:db:migrate failed after transient-error retries', {
    error: lastError,
  });
}
