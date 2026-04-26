import { assert } from '@gamezilla/lib/assert';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';

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
  const patchDb = new PatchDbImplPostgres(createSqlClient(databaseUrl));
  await patchDb.migrate();
  process.stdout.write('[db:migrate] completed\n');
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
