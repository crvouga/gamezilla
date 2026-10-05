import { expect, test } from 'bun:test';
import { claimUsernameMutation } from '@libs/profile-shared/claim-username-mutation';
import { ensureProfileMutation } from '@libs/profile-shared/ensure-profile-mutation';
import { PROFILE_QUERIES } from '@libs/profile-shared/queries';
import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared/v2';

test('every profile snapshot carries the current username uniqueness value', async () => {
  // regression: profile-snapshot-stale-username-claim
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(db, registerTables(PROFILE_TABLES));
  const env = {
    actorId: 'alice',
    deviceId: 'laptop',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date(1_700_000_000_000),
    createId: () => 'unused',
  };
  try {
    await ensureProfileMutation.run({ tx: db, env }, { username: 'alice_old' });
    await claimUsernameMutation.run({ tx: db, env }, { username: 'ALICE_NEW' });
    const context = {
      db: { query: (q: Sql<unknown>) => db.query(q as Sql<QueryRow>) },
      env,
    };
    const [own, others] = PROFILE_QUERIES;
    for (const snapshot of [
      await own.run(context, {}),
      await others.run(context, { ids: ['alice'] }),
    ]) {
      expect(snapshot['profile']).toEqual([
        expect.objectContaining({
          id: 'alice',
          username: 'alice_new',
          username_norm: 'alice_new',
        }),
      ]);
    }
  } finally {
    await db.disconnect();
  }
});
