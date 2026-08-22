// @io-wall-ok
// @api-wall-ok
import { assert } from '@pkgs/assert';
import { migratePostgresApp } from '@libs/db/server/migrate';

const wait = process.argv.includes('--wait');
const databaseUrlFlag = process.argv.find((arg) =>
  arg.startsWith('--database-url=')
);
const databaseUrl = databaseUrlFlag?.slice('--database-url='.length);

await migratePostgresApp(
  databaseUrl === undefined ? { wait } : { wait, databaseUrl }
).catch((error: unknown) => {
  assert.fail('api:db:migrate failed', { error });
});
