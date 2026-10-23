import { expect, test } from 'bun:test';
import { FRIENDS_QUERIES } from '@libs/friends-shared-ts/queries';
import { FRIENDS_TABLES } from '@libs/friends-shared-ts/tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

test('friend profiles carry the same username uniqueness value as own profiles', async () => {
  // regression: profile-snapshot-stale-username-claim
  const db = await openConformanceDb([...FRIENDS_TABLES, ...PROFILE_TABLES]);
  const stamp = '2026-10-01T00:00:00.000Z';
  try {
    await db.run(sql`
      INSERT INTO profile (id, username, username_norm, created_at)
      VALUES (${'bob'}, ${'bob_new'}, ${'bob_new'}, ${stamp})
    `);
    await db.run(sql`
      INSERT INTO friends_friendships (id, user_low, user_high, created_at)
      VALUES (${'alice-bob'}, ${'alice'}, ${'bob'}, ${stamp})
    `);
    const [friendships] = FRIENDS_QUERIES;
    const snapshot = await friendships.run(
      {
        db: { query: (q: Sql<unknown>) => db.query(q as Sql<QueryRow>) },
        env: {
          actorId: 'alice',
          accountId: 'alice',
          deviceId: 'phone',
          isAnon: false,
          now: () => new Date(stamp),
        },
      },
      {}
    );
    expect(snapshot['profile']).toEqual([
      expect.objectContaining({
        id: 'bob',
        username: 'bob_new',
        username_norm: 'bob_new',
      }),
    ]);
  } finally {
    await db.disconnect();
  }
});
