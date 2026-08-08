/**
 * CLI entry for root `bun run db:migrate` / infra migrate phase.
 * Local `@apps/postgres` boot migrates in-process via `@libs/db`.
 */
import { assert } from '@pkgs/assert';
import { migratePostgresApp } from './migrate';

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
