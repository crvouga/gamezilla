// @io-wall-ok
// @api-wall-ok
/**
 * CLI entry for root `bun run db:migrate` / infra migrate phase.
 * Tests/CI boot `@pkgs/postgres-mockingbird-server` then migrate via `@libs/runtime`.
 */

import { migratePostgresApp } from '@libs/runtime-server/migrate';
import { assert } from '@pkgs/assert-root-shared/singleton';

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
