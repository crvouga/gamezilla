/**
 * CLI entry for root `bun run db:migrate` / infra migrate phase /
 * `@apps/postgres` local boot (subprocess with `--database-url=`).
 */
import { assert } from '@pkgs/assert';
import { migratePostgresApp } from './migrate';

const wait = process.argv.includes('--wait');
const databaseUrlFlag = process.argv.find((arg) =>
  arg.startsWith('--database-url=')
);
const databaseUrl = databaseUrlFlag?.slice('--database-url='.length);

await migratePostgresApp({ wait, databaseUrl }).catch((error: unknown) => {
  assert.fail('api:db:migrate failed', { error });
});
