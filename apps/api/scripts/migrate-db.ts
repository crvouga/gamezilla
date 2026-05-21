import { assert } from '@gamezilla/assert';
import { createLogger } from '@gamezilla/logger';
import { createDopplerSecretStoreForScripts } from '@gamezilla/secret-store';
import { SqlClientImplPg } from '@gamezilla/sql-client/impl-pg';
import { sanitizePostgresUrlForNodePg } from '@gamezilla/sql-client/sanitize-postgres-url-for-node-pg';
import { Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '@gamezilla/auth/server/better-auth-doppler-options';
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
