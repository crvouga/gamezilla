import { expect, test } from 'bun:test';
import { PROFILE_TABLES } from '@libs/profile/public/schema';
import {
  claimUsernameMutation,
  ensureProfileMutation,
} from '@libs/profile/root/mutations';
import { PROFILE_QUERIES } from '@libs/profile/root/queries';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import type { Sql } from '@pkgs/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import type { QueryRow } from '@pkgs/sync-engine/shared';

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
