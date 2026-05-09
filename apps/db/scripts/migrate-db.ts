import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import { SqlClientImplPg } from '@gamezilla/lib/sql-client/impl-pg';
import { Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '../src/migrations/better-auth-doppler-options';
import { runPostgresMigrations } from '../src/migrations/run-postgres-migrations';

async function main(): Promise<void> {
  const store = createDopplerSecretStoreForScripts();
  const databaseUrl = await store.getRequired('DB_URL');
  const pool = new Pool({ connectionString: databaseUrl });
  const sqlClient = new SqlClientImplPg(pool);
  const log = createLogger({ name: 'db:migrate' });
  await sqlClient.connect();
  try {
    await runPostgresMigrations({
      sqlClient,
      pool,
      logger: log,
      betterAuthOptions: await loadBetterAuthOptionsForMigration(store),
    });
    log.info(
      'postgres migrations finished (patch-db + kv + better-auth; legacy entities dropped if present)'
    );
    process.stdout.write(
      '[db:migrate] completed (patch-db + kv + better-auth; legacy entities dropped if present)\n'
    );
  } finally {
    await pool.end();
  }
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
