import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SpaceUserCol,
  SPACES_TABLE,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, sql, type Sql, ident } from '@pkgs/sql';

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
  await db.run(sql`CREATE TABLE ${ident(SPACES_TABLE.tableName)} (
      ${ident(SpaceCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceCol.title)} TEXT,
      ${ident(SpaceCol.hostId)} TEXT,
      ${ident(SpaceCol.createdAt)} TEXT,
      ${ident(SpaceCol.endedAt)} TEXT,
      ${ident(SpaceCol.visibility)} TEXT,
      ${ident(SpaceCol.hostAccountId)} TEXT,
      ${ident(SpaceCol.hostMemberId)} TEXT
    )`);
  await db.run(sql`CREATE TABLE ${ident(SPACE_USERS_TABLE.tableName)} (
      ${ident(SpaceUserCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceUserCol.spaceId)} TEXT,
      ${ident(SpaceUserCol.userId)} TEXT,
      ${ident(SpaceUserCol.createdAt)} TEXT,
      ${ident(SpaceUserCol.createdByAccountId)} TEXT
    )`);
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
  await db.run(
    honey({
      insertInto: SPACES_TABLE.tableName,
      values: {
        [SpaceCol.id]: args.id,
        [SpaceCol.hostId]: DEVICE_ID,
        [SpaceCol.hostMemberId]: args.hostAccountId,
        [SpaceCol.hostAccountId]: args.hostAccountId,
        [SpaceCol.visibility]: args.visibility,
        [SpaceCol.endedAt]: args.endedAt,
        [SpaceCol.createdAt]: args.createdAt,
      },
    })
  );
}

async function seedSpaceUser(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<void> {
  await db.run(
    honey({
      insertInto: SPACE_USERS_TABLE.tableName,
      values: {
        [SpaceUserCol.id]: spaceUserEntityId(spaceId, userId),
        [SpaceUserCol.spaceId]: spaceId,
        [SpaceUserCol.userId]: userId,
        [SpaceUserCol.createdAt]: '2026-01-01T00:00:00.000Z',
        [SpaceUserCol.createdByAccountId]: OTHER_ACCOUNT,
      },
    })
  );
}

async function queryIds(db: SqlClient, query: Sql): Promise<string[]> {
  const rows = await db.query<{ readonly id: string }>(query);
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

  test('buildCurrentSpaceEntries uses open ids + live rows', () => {
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
        [HOST_SPACE],
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
        [HOST_SPACE],
        ACCOUNT_ID
      )
    ).toEqual([]);
  });
});
