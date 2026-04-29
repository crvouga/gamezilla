import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { runPostgresMigrations } from '../src/postgres-migrations';

function resolveDatabaseUrlFromEnv(): string {
  const raw = process.env['DB_URL'];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    assert.fail(
      'DB_URL is required (non-empty). Export DB_URL for the target database before running migrate.'
    );
  }
  return raw.trim();
}

function createSqlClient(databaseUrl: string): SqlClient {
  return databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrlFromEnv();
  const sqlClient = createSqlClient(databaseUrl);
  const log = createLogger({ name: 'db:migrate' });
  await sqlClient.transaction(async (tx) => {
    await runPostgresMigrations({ sqlClient: tx, logger: log });
  });
  log.info('transaction committed (patch-db + kv + entity-db)');
  process.stdout.write('[db:migrate] completed (patch-db + kv + entity-db)\n');
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
