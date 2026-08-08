/**
 * Run `@apps/api/db` migrations against the local embedded DATABASE_URL.
 */
import { migratePostgresApp } from '@apps/api/db/migrate';
import { LOCAL_DATABASE_URL } from './ports';

export async function runLocalMigrate(): Promise<void> {
  process.stdout.write('[postgres] migrating…\n');
  await migratePostgresApp({
    wait: true,
    databaseUrl: LOCAL_DATABASE_URL,
  });
  process.stdout.write('[postgres] migrate complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
