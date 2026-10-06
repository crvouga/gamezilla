// @api-wall-ok
// @io-wall-ok
/**
 * Programmatic app Postgres reconcile orchestration.
 *
 * This is composition-root work — it reconciles *this product's* schema — so it
 * lives with the fold rather than in `@libs/db`. An infra package that
 * depended on the composition root made a cycle the moment features started
 * depending on the server shell.
 *
 * Root `db:migrate` / infra run `libs/runtime-server/scripts/migrate-cli.ts`. Tests
 * and CI boot `@pkgs/postgres-mockingbird-server` first.
 */

import { join } from 'node:path';
import { assertNonProdDatabaseUrlForTooling } from '@libs/db-server/database-url-policy-tooling';
import { readDevVarsDatabaseUrl } from '@libs/db-server/dev-vars';
import {
  isPostgresTransientMigrateError,
  transientMigrateRetryReason,
} from '@libs/db-server/migrate-transient-errors';
import { fetchSecret } from '@libs/db-server/secret-io';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { isProductionEnv } from '@libs/infra-shared/env-file';
import { envFile, PRODUCTION_ENV_NAMES } from '@libs/infra-shared/envs';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import type { Logger } from '@pkgs/logger-shared/logger';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { createScriptSecretStore } from '@pkgs/secret-store-shared/create-script-secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import { pingPostgres } from '@pkgs/sql-client-postgres-server/ping';
import { reconcilePostgres } from './reconcile-postgres';

const REPO_ROOT = join(import.meta.dirname, '../../..');
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

export function selectMigrateDatabaseUrl(candidates: {
  readonly override?: string | undefined;
  readonly live?: string | undefined;
  readonly injected?: string | undefined;
}): string | undefined {
  for (const candidate of [
    candidates.override,
    candidates.live,
    candidates.injected,
  ]) {
    const url = candidate?.trim() ?? '';
    if (isPostgresUrl(url)) return url;
  }
  return undefined;
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
  const explicit = selectMigrateDatabaseUrl({ override });
  if (explicit !== undefined) return explicit;

  let live: string | undefined;
  if (!preferLocalSecretsOnly()) {
    try {
      live = await fetchSecret('DATABASE_URL');
    } catch {
      // Infisical unavailable — fall through to local `.dev.vars`.
    }
  }
  const selected = selectMigrateDatabaseUrl({
    live,
    injected: process.env['DATABASE_URL'],
  });
  if (selected !== undefined) return selected;

  const fromDevVars = readDevVarsDatabaseUrl();
  if (fromDevVars !== null && isPostgresUrl(fromDevVars)) {
    return fromDevVars;
  }
  const store = createScriptSecretStore();
  return (await store.getRequired('DATABASE_URL')).readSecretValue();
}

/**
 * A production environment's deploy migrates its own database; every other
 * environment must not be pointed at a production one.
 */
async function assertMigrateDatabasePolicy(databaseUrl: string): Promise<void> {
  const secretsEnv = await resolveSecretsEnvForMigrate();
  if (isProductionEnv(envFile(secretsEnv))) return;
  await assertNonProdDatabaseUrlForTooling(databaseUrl, PRODUCTION_ENV_NAMES, {
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

  assert.fail('postgres did not become reachable before reconcile', {
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
    await reconcilePostgres({
      sqlClient,
      logger: log,
      dbScope,
      clock: wallClock,
    });
    log.info(
      'postgres reconciled (schema + kv + IdP + autoidx; matchmaking reconciles on first request)'
    );
    process.stdout.write(
      '[api:db:migrate] reconciled (schema + kv + IdP + autoidx; matchmaking reconciles on first request)\n'
    );
  } finally {
    await pool.end();
  }
}

/**
 * Reconcile the composed app schemas against the resolved (or overridden) URL.
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
