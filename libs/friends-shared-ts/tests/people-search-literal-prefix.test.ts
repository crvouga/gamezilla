import { expect, test } from 'bun:test';
import { FRIENDS_QUERIES } from '@libs/friends-shared-ts/queries';
import { FRIENDS_TABLES } from '@libs/friends-shared-ts/tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { usernamePrefix } from '@libs/user-search-shared-ts/username-prefix';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';

const STAMP = '2026-10-01T00:00:00.000Z';

test('username underscores are literal in the server query and shared prefix pattern', async () => {
  // regression: people-search-underscore-wildcard
  const db = await openConformanceDb([...FRIENDS_TABLES, ...PROFILE_TABLES]);
  try {
    for (const name of ['a_b', 'abc', 'a_c']) {
      await db.run(sql`INSERT INTO profile (id, username, username_norm, created_at, updated_at)
        VALUES (${name}, ${name}, ${name}, ${STAMP}, ${STAMP})`);
    }
    const query = FRIENDS_QUERIES.find(
      (entry) => entry.name === 'searchProfiles'
    );
    if (!query) throw new Error('searchProfiles missing');
    const result = await query.run(
      {
        db: {
          query: (statement: Sql<unknown>) =>
            db.query(statement as Sql<Record<string, unknown>>),
        },
        env: {
          actorId: 'viewer',
          accountId: 'viewer',
          deviceId: 'device',
          isAnon: false,
          now: () => new Date(STAMP),
        },
      },
      { query: ' A_ ' } as never
    );
    expect(result['profile']?.map((row) => row['username'])).toEqual([
      'a_b',
      'a_c',
    ]);
    const local = await db.query(sql<{
      username: string;
    }>`SELECT username FROM profile
      WHERE username_norm LIKE ${usernamePrefix('a_')} ESCAPE '!' ORDER BY username_norm`);
    expect(local.map((row) => row.username)).toEqual(['a_b', 'a_c']);
    expect(usernamePrefix('!%_')).toBe('!!!%!_%');
  } finally {
    await db.disconnect();
  }
});
