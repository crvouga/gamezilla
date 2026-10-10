import { beforeEach, describe, expect, test } from 'bun:test';
import { buildCurrentSpaceEntries } from '@libs/spaces-client/build-current-space-entries';
import { sharedLiveSpaceIdsSql } from '@libs/spaces-client/my-live-space-seat-sql';
import { spaceUserEntityId } from '@libs/spaces-shared/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared/tables';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql from '@pkgs/sql-root-shared/sql';

const HOST_SPACE = 'space-host-1';
const SHARED_SPACE = 'space-shared-1';
const FRIEND_HOST_SPACE = 'space-friend-host-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const OTHER_ACCOUNT = 'account-other-cccc-2222';
const FRIEND_GUEST = 'account-friend-guest-3333';

/** Mirrors @libs/friends schema (spaces→friends would cycle). */
const friendsFriendships = defineTable({
  domain: 'friends',
  name: 'friends_friendships',
  columns: {
    user_low: 'text',
    user_high: 'text',
    source_request_id: 'text',
  },
  uniqueIndexes: [['user_low', 'user_high']],
});

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
}

async function migrate(db: SqlClient): Promise<void> {
  await reconcileSqliteSchema(
    db,
    registerTables([...SPACES_TABLES, friendsFriendships])
  );
}

async function seedSpace(
  db: SqlClient,
  args: {
    readonly id: string;
    readonly hostAccountId: string;
    readonly visibility: string;
    readonly endedAt: string | null;
    readonly createdAt: string;
  }
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO spaces (
      id, host_id, host_member_id, host_account_id, visibility, ended_at, created_at
    )
    VALUES (
      ${args.id},
      ${DEVICE_ID},
      ${args.hostAccountId},
      ${args.hostAccountId},
      ${args.visibility},
      ${args.endedAt},
      ${args.createdAt}
    )
  `);
}

async function seedSpaceUser(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO spaces_users (id, space_id, user_id, created_at, created_by_account_id, joined, participation_revision)
    VALUES (
      ${spaceUserEntityId(spaceId, userId)},
      ${spaceId},
      ${userId},
      ${'2026-01-01T00:00:00.000Z'},
      ${OTHER_ACCOUNT}, ${true}, ${0}
    )
  `);
}

async function queryIds(
  db: SqlClient,
  query: Sql<{ readonly id: string }>
): Promise<string[]> {
  const rows = await db.query(query);
  return rows.map((r) => r.id);
}

describe('my-live-space-seat-sql — host / spaces_users lobby', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
  });

  test('host space appears in shared list without spaces_users row', async () => {
    await seedSpace(db, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({ memberId: ACCOUNT_ID })
    );
    expect(sharedIds).toContain(HOST_SPACE);
  });

  test('ended host space is excluded from shared list', async () => {
    await seedSpace(db, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: '2026-01-02T01:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({ memberId: ACCOUNT_ID })
    );
    expect(sharedIds).not.toContain(HOST_SPACE);
  });

  test('spaces_users ACL private space appears in shared list', async () => {
    await seedSpace(db, {
      id: SHARED_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await seedSpaceUser(db, SHARED_SPACE, ACCOUNT_ID);

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({ memberId: ACCOUNT_ID })
    );
    expect(sharedIds).toContain(SHARED_SPACE);
  });

  test('friend-hosted live private space appears in shared list', async () => {
    await seedSpace(db, {
      id: FRIEND_HOST_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-04T00:00:00.000Z',
    });
    await db.run(sql<void>`
      INSERT INTO friends_friendships (id, user_low, user_high, deleted_at, created_at)
      VALUES ('friendship-1', ${ACCOUNT_ID}, ${OTHER_ACCOUNT}, ${null}, ${'2026-01-01T00:00:00.000Z'})
    `);

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({ memberId: ACCOUNT_ID })
    );
    expect(sharedIds).toContain(FRIEND_HOST_SPACE);
  });

  test('a friend seated in someone else\u2019s live space appears in shared list', async () => {
    await seedSpace(db, {
      id: SHARED_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-05T00:00:00.000Z',
    });
    await seedSpaceUser(db, SHARED_SPACE, FRIEND_GUEST);
    await db.run(sql<void>`
      INSERT INTO friends_friendships (id, user_low, user_high, deleted_at, created_at)
      VALUES ('friendship-2', ${ACCOUNT_ID}, ${FRIEND_GUEST}, ${null}, ${'2026-01-01T00:00:00.000Z'})
    `);

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({ memberId: ACCOUNT_ID })
    );
    expect(sharedIds).toContain(SHARED_SPACE);
  });
  test('buildCurrentSpaceEntries uses live joined rows', () => {
    expect(
      buildCurrentSpaceEntries(
        [
          {
            id: HOST_SPACE,
            host_member_id: ACCOUNT_ID,
            host_account_id: ACCOUNT_ID,
            ended_at: null,
          },
        ],
        ACCOUNT_ID
      )
    ).toEqual([{ spaceId: HOST_SPACE, role: 'host' }]);
    expect(
      buildCurrentSpaceEntries(
        [
          {
            id: HOST_SPACE,
            host_member_id: ACCOUNT_ID,
            host_account_id: ACCOUNT_ID,
            ended_at: '2026-01-02T01:00:00.000Z',
          },
        ],
        ACCOUNT_ID
      )
    ).toEqual([]);
  });
});
