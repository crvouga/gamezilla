import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { runPostgresMigrations } from '../src/postgres-migrations';

async function resolveDatabaseUrlFromDoppler(): Promise<string> {
  const store = createDopplerSecretStoreForScripts();
  return store.getRequired('DB_URL');
}

function createSqlClient(databaseUrl: string): SqlClient {
  return databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
}

async function main(): Promise<void> {
  const databaseUrl = await resolveDatabaseUrlFromDoppler();
  const sqlClient = createSqlClient(databaseUrl);
  const log = createLogger({ name: 'db:migrate' });
  await runPostgresMigrations({ sqlClient, logger: log });
  log.info('postgres migrations finished (patch-db + kv up, entity-db down)');
  process.stdout.write(
    '[db:migrate] completed (patch-db + kv up, entity-db down)\n'
  );
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
