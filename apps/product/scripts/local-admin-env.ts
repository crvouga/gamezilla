// @io-wall-ok — localhost stack composition root.
import { assertNonProdDatabaseUrl } from '@libs/db-shared/database-url-policy';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import type { LocalAdminIdentity } from './local-admin-accounts';
import { LocalAdminSeeder } from './local-admin-seeder';

/** Seed before API boot so every node publishes the same local permission policy. */
export async function localAdminEnv(
  databaseUrl: string,
  identities: readonly LocalAdminIdentity[]
) {
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname)
  )
    throw new Error('Local admin accounts require a loopback database');
  await assertNonProdDatabaseUrl(databaseUrl);
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    const seeder = new LocalAdminSeeder(
      {
        clock: wallClock,
        createId: () => crypto.randomUUID(),
      },
      identities
    );
    await seeder.seed({
      sqlClient,
      logger: createLogger({
        name: 'localhost-stack:admins',
        now: wallClock.now,
      }),
    });
    return { PUZZLE_MANAGER_ACCOUNT_IDS: JSON.stringify(seeder.accountIds) };
  } finally {
    await pool.end();
  }
}
