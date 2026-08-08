/**
 * CLI entry for root `bun run db:migrate` / infra migrate phase.
 * Prefer importing {@link migratePostgresApp} from `@apps/api/db/migrate` in-process.
 */
import { assert } from '@pkgs/assert';
import { migratePostgresApp } from './migrate';

const wait = process.argv.includes('--wait');

await migratePostgresApp({ wait }).catch((error: unknown) => {
  assert.fail('api:db:migrate failed', { error });
});
