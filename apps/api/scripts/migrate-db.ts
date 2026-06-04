import { assert } from '@pkgs/assert';
import { createLogger, type Logger } from '@pkgs/logger';
import { createDopplerSecretStoreForScripts } from '@pkgs/secret-store';
import { SqlClientImplPg } from '@pkgs/sql-client/impl-pg';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client/sanitize-postgres-url-for-node-pg';
import { Client, Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '@libs/auth/server/better-auth-doppler-options';
import { runPostgresMigrations } from '../src/migrations/run-postgres-migrations';

const CONNECTION_LIMIT_DELAYS_MS = [0, 3_000, 8_000, 15_000, 30_000] as const;
const WAIT_FOR_POSTGRES_MS = 60_000;
const WAIT_FOR_POSTGRES_RETRY_MS = 1_000;
const WAIT_FOR_POSTGRES = process.argv.includes('--wait');

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
  return (await store.getRequired('DB_URL')).readSecretValue();
}

async function waitForPostgresReachable(
  databaseUrl: string,
  log: Logger
): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  let lastError: unknown = null;
  const connectionString = sanitizePostgresUrlForNodePg(databaseUrl);

  while (Date.now() - started < WAIT_FOR_POSTGRES_MS) {
    attempt += 1;
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query('SELECT 1');
      if (attempt > 1) {
        log.info('postgres reachable for migrate', {
          attempt,
          elapsedMs: Date.now() - started,
        });
      }
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
      if (attempt === 1 || attempt % 5 === 0) {
        log.info('waiting for postgres before migrate', {
          attempt,
          elapsedMs: Date.now() - started,
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
  if (WAIT_FOR_POSTGRES) {
    const databaseUrl = await resolveDatabaseUrlForMigrate();
    await waitForPostgresReachable(databaseUrl, log);
  }
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
