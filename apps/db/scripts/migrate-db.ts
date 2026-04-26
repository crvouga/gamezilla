import { assert } from '@gamezilla/lib/assert';
import { DopplerCli } from '@gamezilla/lib/doppler';
import {
  createCachingSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';

type MigrateTarget = 'local' | 'prod';

const MIGRATE_USAGE = 'usage: bun run scripts/migrate-db.ts <local|prod>';

function databaseUrlSecretForTarget(target: MigrateTarget): string {
  return target === 'prod' ? 'PROD_DATABASE_URL' : 'LOCAL_DATABASE_URL';
}

function parseMigrateTarget(): MigrateTarget {
  const rawArg = process.argv[2];
  assert.nonEmptyString(rawArg, MIGRATE_USAGE);
  const raw = rawArg.trim().toLowerCase();
  assert.enum(raw, ['local', 'prod'], MIGRATE_USAGE);
  return raw;
}

function resolveDopplerToken(): string {
  try {
    return new DopplerCli().resolveToken().token;
  } catch (error: unknown) {
    assert.fail('failed to resolve Doppler token', { error });
  }
}

function createSqlClient(databaseUrl: string): SqlClient {
  return databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
}

async function resolveDatabaseUrl(
  token: string,
  target: MigrateTarget
): Promise<string> {
  const secretName = databaseUrlSecretForTarget(target);
  const secretStore = createCachingSecretStore(
    new DopplerSecretStore({ token, configName: 'shared' }),
    { ttlMs: 60_000 }
  );
  const databaseUrl = await secretStore.getRequired(secretName);
  assert.ok(
    databaseUrl.trim().length > 0,
    `${secretName} resolved blank for migrate target ${target}`
  );
  return databaseUrl;
}

async function main(): Promise<void> {
  const target = parseMigrateTarget();
  const token = resolveDopplerToken();
  const databaseUrl = await resolveDatabaseUrl(token, target);
  const patchDb = new PatchDbImplPostgres(createSqlClient(databaseUrl));
  await patchDb.migrate();
  process.stdout.write(`[db:migrate] completed for ${target}\n`);
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
