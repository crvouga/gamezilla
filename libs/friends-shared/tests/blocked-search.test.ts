import { expect, test } from 'bun:test';
import { FRIENDS_TABLES } from '@libs/friends-shared/tables';
import { FRIENDS_QUERIES } from '@libs/friends-shared/queries';
import { openConformanceDb } from '@libs/permissions-shared/world';
import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';

const STAMP = '2026-10-01T00:00:00.000Z';

test('the server withholds a blocker from search while preserving the unblock route', async () => {
  // regression: friend-block-server-search-disclosure
  const db = await openConformanceDb([...FRIENDS_TABLES, ...PROFILE_TABLES]);
  try {
    await db.run(sql`
      INSERT INTO profile (id, username, username_norm, created_at, updated_at)
      VALUES (${'alice'}, ${'alice'}, ${'alice'}, ${STAMP}, ${STAMP}),
        (${'bob'}, ${'bob'}, ${'bob'}, ${STAMP}, ${STAMP})`);
    await db.run(sql`
      INSERT INTO friends_blocks (id, blocker_id, blocked_id, created_at, updated_at)
      VALUES (${'alice-blocks-bob'}, ${'alice'}, ${'bob'}, ${STAMP}, ${STAMP})`);
    const query = FRIENDS_QUERIES.find((q) => q.name === 'searchProfiles');
    if (query === undefined) throw new Error('searchProfiles missing');
    const context = (person: string) => ({
      db: {
        query: (statement: Sql<unknown>) =>
          db.query(statement as Sql<Record<string, unknown>>),
      },
      env: {
        actorId: person,
        accountId: person,
        deviceId: person,
        isAnon: false,
        now: () => new Date(STAMP),
      },
    });
    expect(
      await query.run(context('bob'), { query: 'alice' } as never)
    ).toEqual({ profile: [] });
    const found = await query.run(context('alice'), { query: 'bob' } as never);
    expect(found['profile']).toHaveLength(1);
    await db.run(
      sql`UPDATE friends_blocks SET deleted_at = ${STAMP} WHERE id = ${'alice-blocks-bob'}`
    );
    const unblocked = await query.run(context('bob'), {
      query: 'alice',
    } as never);
    expect(unblocked['profile']).toHaveLength(1);
    await db.run(
      sql`UPDATE profile SET deleted_at = ${STAMP} WHERE id = ${'alice'}`
    );
    const removed = await query.run(context('bob'), {
      query: 'alice',
    } as never);
    expect(removed['profile']).toEqual([
      expect.objectContaining({ id: 'alice', deleted_at: STAMP }),
    ]);
  } finally {
    await db.disconnect();
  }
});
