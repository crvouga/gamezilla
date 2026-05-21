import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { createDopplerSecretStoreForScripts } from '@pkgs/secret-store';
import { SqlClientImplPg } from '@pkgs/sql-client/impl-pg';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client/sanitize-postgres-url-for-node-pg';
import { Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '@libs/auth/server/better-auth-doppler-options';
import { runPostgresMigrations } from '../src/migrations/run-postgres-migrations';

async function main(): Promise<void> {
  const store = createDopplerSecretStoreForScripts();
  const databaseUrl = await store.getRequired('DB_URL');
  const pool = new Pool({
    connectionString: sanitizePostgresUrlForNodePg(databaseUrl),
  });
  const sqlClient = new SqlClientImplPg(pool);
  const log = createLogger({ name: 'api:migrate' });
  await sqlClient.connect();
  try {
    await runPostgresMigrations({
      sqlClient,
      databaseUrl,
      logger: log,
      betterAuthOptions: await loadBetterAuthOptionsForMigration(store),
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

await main().catch((error: unknown) => {
  assert.fail('api:migrate failed', { error });
});
