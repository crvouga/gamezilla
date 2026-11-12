import { expect, test } from 'bun:test';
import { mySpaceUsers } from '@libs/spaces-shared-ts/my-space-users-query';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';

const SPACES = 30;
const MEMBERS_PER_SPACE = 3;
const ROWS = SPACES * MEMBERS_PER_SPACE;

/**
 * A server database holding `SPACES` spaces of three members each, whose
 * `spaces_users` counts every row it hands out (a view over the stored rows
 * that calls back into the test for each one).
 */
function countingDatabase(): {
  readonly client: SqlClientImplMockingbirdPostgres;
  readonly reads: () => number;
} {
  const client = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    installSqliteCompat: false,
  });
  const db = client.rawDb;
  let reads = 0;
  db.registerFunction({
    name: 'counted_read',
    args: ['text'],
    returns: 'boolean',
    fn: () => {
      reads += 1;
      return true;
    },
  });
  db.exec(
    'CREATE TABLE spaces (id text PRIMARY KEY, host_member_id text, host_account_id text)'
  );
  db.exec(
    'CREATE TABLE spaces_users_rows (id text PRIMARY KEY, space_id text, user_id text, created_at text, created_by_account_id text, joined boolean, participation_revision integer, deleted_at text)'
  );
  db.exec(
    'CREATE VIEW spaces_users AS SELECT * FROM spaces_users_rows WHERE counted_read(id)'
  );
  for (let space = 0; space < SPACES; space++) {
    db.exec(
      `INSERT INTO spaces VALUES ('s${space}', 'm${space}', 'a${space}')`
    );
    for (let seat = 0; seat < MEMBERS_PER_SPACE; seat++)
      db.exec(
        `INSERT INTO spaces_users_rows VALUES ('su${space}-${seat}', 's${space}', 'm${(space + seat) % SPACES}', '', NULL, true, 0, NULL)`
      );
  }
  return { client, reads: () => reads };
}

// regression: my-space-users-scope-cost-grows-with-every-space
test("a person's space members are read in one pass over the memberships", async () => {
  const { client, reads } = countingDatabase();
  try {
    const result = await mySpaceUsers.run(
      {
        db: {
          query: (query: Sql<unknown>) =>
            client.query(query as Sql<Record<string, unknown>>),
        },
        env: {
          actorId: 'm7',
          deviceId: 'device-m7',
          accountId: null,
          isAnon: true,
          now: () => new Date(0),
        },
      },
      {}
    );
    // m7 hosts s7 and sits in s5, s6 and s7: their nine seats.
    expect(
      result['spaces_users']?.map((row) => String(row['id'])).sort()
    ).toEqual(
      ['s5', 's6', 's7'].flatMap((space) =>
        [0, 1, 2].map((seat) => `su${space.slice(1)}-${seat}`)
      )
    );
    // Linear in the memberships stored, not in their square or cube: the
    // nested form read every membership again for every row it tested.
    expect(reads()).toBeLessThanOrEqual(3 * ROWS);
  } finally {
    await client.disconnect();
  }
});
