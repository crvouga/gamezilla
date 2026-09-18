// @io-wall-ok
/**
 * Postgres migrations using secret-store `DATABASE_URL` (ignores stale `.dev.vars`).
 * Used by sync setup/deploy so schema + publication target the same DB.
 *
 * Retries on transient Postgres errors (deadlock / too many clients) — same
 * policy as `@apps/server/db/migrate`. Dropping sync tables while
 * sync holds replication locks commonly surfaces `40P01`.
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import { resolveDatabaseUrl } from '@libs/db/shared/postgres-ping-source';
import { PostgresMigrationRunner } from '@libs/runtime/server/run-postgres-migrations';
import { loadSecretsIntoEnv } from '@libs/secrets/shared/secrets/secrets';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

const MIGRATE_RETRY_DELAYS_MS = [0, 3_000, 8_000, 15_000, 30_000] as const;

function isPostgresConnectionLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  if (
    msg.includes('too many clients') ||
    msg.includes('remaining connection slots')
  ) {
    return true;
  }
  const code = (error as { code?: string }).code;
  return code === '53300';
}

function isPostgresDeadlockError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  if (code === '40P01') return true;
  return error.message.toLowerCase().includes('deadlock detected');
}

function isPostgresLockTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  if (code === '55P03') return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('lock timeout') ||
    msg.includes('canceling statement due to lock')
  );
}

function isPostgresTransientMigrateError(error: unknown): boolean {
  return (
    isPostgresConnectionLimitError(error) ||
    isPostgresDeadlockError(error) ||
    isPostgresLockTimeoutError(error)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

async function runPostgresMigrationsFromSecretsOnce(): Promise<void> {
  const databaseUrl = await resolveDatabaseUrl();
  const dbScope = appPostgresDbScope();
  const logger = createLogger({
    name: 'postgres:migrate-secrets',
    now: wallClock.now,
  });
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 1,
  });
  try {
    await new PostgresMigrationRunner({
      sqlClient,
      logger,
      dbScope,
      clock: wallClock,
    }).run();
    process.stdout.write(
      '[postgres:migrate-secrets] schema + sync publication + autoidx OK\n'
    );
  } finally {
    await pool.end();
  }
}

export async function runPostgresMigrationsFromSecrets(): Promise<void> {
  await loadSecretsIntoEnv();
  const logger = createLogger({
    name: 'postgres:migrate-secrets',
    now: wallClock.now,
  });
  let lastError: unknown;

  for (let attempt = 0; attempt < MIGRATE_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = MIGRATE_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delayMs > 0) {
      const reason = isPostgresDeadlockError(lastError)
        ? 'deadlock'
        : isPostgresLockTimeoutError(lastError)
          ? 'lock timeout'
          : 'connection limit';
      logger.warn(`Postgres ${reason} — retrying migrate`, {
        attempt: attempt + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
    try {
      await runPostgresMigrationsFromSecretsOnce();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isPostgresTransientMigrateError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `postgres migrate (secrets) failed after transient-error retries: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

if (import.meta.main) {
  await runPostgresMigrationsFromSecrets();
}
