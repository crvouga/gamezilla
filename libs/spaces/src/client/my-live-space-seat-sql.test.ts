import { beforeEach, describe, expect, test } from 'bun:test';

import { spaceUserEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { type Sql, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { sharedLiveSpaceIdsSql } from '../client/my-live-space-seat-sql';
import { buildCurrentSpaceEntries } from '../client/use-current-space-ids';

const HOST_SPACE = 'space-host-1';
const SHARED_SPACE = 'space-shared-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const OTHER_ACCOUNT = 'account-other-cccc-2222';

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
}

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE spaces (
      id TEXT PRIMARY KEY,
      title TEXT,
      host_id TEXT,
      created_at TEXT,
      ended_at TEXT,
      visibility TEXT,
      host_account_id TEXT,
      host_member_id TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE space_users (
      id TEXT PRIMARY KEY,
      space_id TEXT,
      user_id TEXT,
      created_at TEXT,
      created_by_account_id TEXT
    )
  `);
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
    INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
    VALUES (
      ${spaceUserEntityId(spaceId, userId)},
      ${spaceId},
      ${userId},
      ${'2026-01-01T00:00:00.000Z'},
      ${OTHER_ACCOUNT}
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

describe('my-live-space-seat-sql — host / space_users lobby', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
  });

  test('host space appears in shared list without space_users row', async () => {
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

  test('space_users ACL private space appears in shared list', async () => {
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
