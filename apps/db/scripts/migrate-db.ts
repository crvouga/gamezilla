import {
  createCachingSecretStore,
  createCombinedSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';
import { assert } from '@gamezilla/lib/assert';
import { DopplerCli } from '@gamezilla/lib/doppler';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';

type RuntimeConfigName = 'local' | 'prod';
const DATABASE_URL_SECRET = 'DATABASE_URL';
const MIGRATE_USAGE = 'usage: bun run scripts/migrate-db.ts <local|prod>';

function parseTargetConfigName(): RuntimeConfigName {
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
  configName: RuntimeConfigName
): Promise<string> {
  const envStore = new DopplerSecretStore({ token, configName });
  const sharedStore = new DopplerSecretStore({ token, configName: 'shared' });
  const secretStore = createCachingSecretStore(
    createCombinedSecretStore(envStore, sharedStore),
    { ttlMs: 60_000 }
  );
  const databaseUrl = await secretStore.getRequired(DATABASE_URL_SECRET);
  assert.ok(
    databaseUrl.trim().length > 0,
    `${DATABASE_URL_SECRET} resolved blank for config ${configName}`
  );
  return databaseUrl;
}

async function main(): Promise<void> {
  const configName = parseTargetConfigName();
  const token = resolveDopplerToken();
  const databaseUrl = await resolveDatabaseUrl(token, configName);
  const patchDb = new PatchDbImplPostgres(createSqlClient(databaseUrl));
  await patchDb.migrate();
  process.stdout.write(`[db:migrate] completed for ${configName}\n`);
}

await main().catch((error: unknown) => {
  assert.fail('db:migrate failed', { error });
});
