import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { createDopplerSecretStoreForScripts } from '@pkgs/secret-store';
import { SqlClientImplPg } from '@pkgs/sql-client/impl-pg';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client/sanitize-postgres-url-for-node-pg';
import { Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '@libs/auth/server/better-auth-doppler-options';
import { runPostgresMigrations } from '../src/migrations/run-postgres-migrations';

const CONNECTION_LIMIT_DELAYS_MS = [0, 3_000, 8_000, 15_000, 30_000] as const;

function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveDatabaseUrlForMigrate(): Promise<string> {
  const fromEnv = (process.env['DB_URL'] ?? '').trim();
  if (fromEnv.length > 0 && isPostgresUrl(fromEnv)) {
    return fromEnv;
  }
  const store = createDopplerSecretStoreForScripts();
  return store.getRequired('DB_URL');
}

async function runMigrateOnce(): Promise<void> {
  const databaseUrl = await resolveDatabaseUrlForMigrate();
  const pool = new Pool({
    connectionString: sanitizePostgresUrlForNodePg(databaseUrl),
    max: 1,
  });
  const sqlClient = new SqlClientImplPg(pool);
  const log = createLogger({ name: 'api:migrate' });
  await sqlClient.connect();
  try {
    await runPostgresMigrations({
      sqlClient,
      databaseUrl,
      logger: log,
      betterAuthOptions: await loadBetterAuthOptionsForMigration(
        createDopplerSecretStoreForScripts()
      ),
    });
    log.info(
      'postgres migrations finished (patch-db + kv + better-auth; matchmaking self-migrates on first request; legacy entities dropped if present)'
    );
    process.stdout.write(
      '[api:migrate] completed (patch-db + kv + better-auth; matchmaking self-migrates on first request; legacy entities dropped if present)\n'
    );
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const log = createLogger({ name: 'api:migrate' });
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < CONNECTION_LIMIT_DELAYS_MS.length;
    attempt++
  ) {
    const delayMs = CONNECTION_LIMIT_DELAYS_MS[attempt] ?? 0;
    if (delayMs > 0) {
      log.warn('Postgres connection limit — retrying migrate', {
        attempt: attempt + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
    try {
      await runMigrateOnce();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isPostgresConnectionLimitError(error)) {
        throw error;
      }
    }
  }

  assert.fail('api:migrate failed after connection-limit retries', {
    error: lastError,
  });
}

await main().catch((error: unknown) => {
  assert.fail('api:migrate failed', { error });
});
