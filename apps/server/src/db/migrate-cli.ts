// @io-wall-ok
// @api-wall-ok

import { migratePostgresApp } from '@libs/db/server/migrate';
import { assert } from '@pkgs/assert';

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
