// regression: people-search-unenforced
/**
 * The people search query had no `authorize` hook, and the sync server's
 * default only refuses a caller with no actor id — so a guest (whose install
 * is their actor) got search results from the server though the app hid
 * search from them. The literal case: a guest asks `searchProfiles` for "a"
 * and is refused; a signed-in account asking the same is answered.
 */
import { describe, expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { FRIENDS_QUERIES } from '@libs/friends-shared/queries';
import {
  CASE_NOW_MS,
  identityFor,
} from '@libs/permissions-shared/people';
import { openConformanceDb } from '@libs/permissions-shared/world';
import type { Sql } from '@pkgs/sql-shared/sql';

async function authorized(person: 'guest' | 'free account'): Promise<boolean> {
  const query = FRIENDS_QUERIES.find((q) => q.name === 'searchProfiles');
  if (query?.authorize === undefined) return true;
  const db = await openConformanceDb(BILLING_TABLES);
  try {
    return await query.authorize(
      {
        db: {
          query: (sql) => db.query(sql as Sql<Record<string, unknown>>),
        },
        env: {
          ...identityFor(person),
          deviceId: 'device',
          now: () => new Date(CASE_NOW_MS),
        },
      },
      // The queries' params differ; this one takes a search text.
      { query: 'a' } as never
    );
  } finally {
    await db.disconnect();
  }
}

describe('people search at the server', () => {
  test('a guest is refused', async () => {
    expect(await authorized('guest')).toBe(false);
  });

  test('a signed-in account is answered', async () => {
    expect(await authorized('free account')).toBe(true);
  });
});
