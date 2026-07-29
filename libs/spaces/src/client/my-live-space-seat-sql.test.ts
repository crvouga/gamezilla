import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceMembershipEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, sql, type Sql, ident } from '@pkgs/sql';

import {
  friendsLiveSpaceIdsSql,
  myLiveSeatSpacesSelectSql,
  publicLiveSpaceIdsSql,
} from '../client/my-live-space-seat-sql';
import { buildCurrentSpaceEntries } from '../client/use-current-space-ids';

const HOST_SPACE = 'space-host-1';
const FRIEND_SPACE = 'space-friend-1';
const PUBLIC_SPACE = 'space-public-1';
const PRIVATE_SPACE = 'space-private-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const FRIEND_ACCOUNT = 'account-friend-cccc-2222';

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
      ${ident(SpaceCol.hostMemberId)} TEXT,
      ${ident(SpaceCol.activeMemberCount)} INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(sql`CREATE TABLE ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} (
      ${ident(SpaceMembershipCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceMembershipCol.memberId)} TEXT,
      ${ident(SpaceMembershipCol.spaceId)} TEXT,
      ${ident(SpaceMembershipCol.joinedAt)} TEXT,
      ${ident(SpaceMembershipCol.leftAt)} TEXT,
      ${ident(SpaceMembershipCol.profileId)} TEXT
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
        [SpaceCol.activeMemberCount]: 1,
      },
    })
  );
}

async function seedMembership(
  db: SqlClient,
  args: {
    readonly memberId: string;
    readonly spaceId: string;
    readonly leftAt: string | null;
  }
): Promise<void> {
  await db.run(
    honey({
      insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
      values: {
        [SpaceMembershipCol.id]: spaceMembershipEntityId(
          args.memberId,
          args.spaceId
        ),
        [SpaceMembershipCol.memberId]: args.memberId,
        [SpaceMembershipCol.spaceId]: args.spaceId,
        [SpaceMembershipCol.joinedAt]: '2026-01-01T00:00:00.000Z',
        [SpaceMembershipCol.leftAt]: args.leftAt,
        [SpaceMembershipCol.profileId]: args.memberId,
      },
    })
  );
}

async function queryIds(db: SqlClient, query: Sql): Promise<string[]> {
  const rows = await db.query<{ readonly id: string }>(query);
  return rows.map((r) => r.id);
}

describe('my-live-space-seat-sql — active membership seats', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
  });

  test('left host seat is excluded from friends list and miniplayer seats', async () => {
    await seedSpace(db, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(db, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: '2026-01-02T01:00:00.000Z',
    });

    const friendsIds = await queryIds(
      db,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).not.toContain(HOST_SPACE);

    const seats = await db.query<{
      readonly id: string;
      readonly host_member_id: string | null;
      readonly host_account_id: string | null;
      readonly ended_at: string | null;
      readonly joined_at: string | null;
    }>(myLiveSeatSpacesSelectSql(ACCOUNT_ID));
    expect(seats.map((r) => r.id)).not.toContain(HOST_SPACE);
    expect(buildCurrentSpaceEntries(seats, ACCOUNT_ID)).toEqual([]);
  });

  test('active host seat is included in friends list and miniplayer seats', async () => {
    await seedSpace(db, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(db, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: null,
    });

    const friendsIds = await queryIds(
      db,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).toContain(HOST_SPACE);

    const seats = await db.query<{
      readonly id: string;
      readonly host_member_id: string | null;
      readonly host_account_id: string | null;
      readonly ended_at: string | null;
      readonly joined_at: string | null;
    }>(myLiveSeatSpacesSelectSql(ACCOUNT_ID));
    expect(seats.map((r) => r.id)).toContain(HOST_SPACE);
    expect(buildCurrentSpaceEntries(seats, ACCOUNT_ID)).toEqual([
      { spaceId: HOST_SPACE, role: 'host' },
    ]);
  });

  test('friends-visibility space hosted by someone else still appears', async () => {
    await seedSpace(db, {
      id: FRIEND_SPACE,
      hostAccountId: FRIEND_ACCOUNT,
      visibility: 'friends',
      endedAt: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await seedSpace(db, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'friends',
      endedAt: '2026-01-02T01:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(db, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: '2026-01-02T01:00:00.000Z',
    });

    const friendsIds = await queryIds(
      db,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).toContain(FRIEND_SPACE);
    expect(friendsIds).not.toContain(HOST_SPACE);
  });

  test('public list only includes visibility=public live spaces', async () => {
    await seedSpace(db, {
      id: PUBLIC_SPACE,
      hostAccountId: FRIEND_ACCOUNT,
      visibility: 'public',
      endedAt: null,
      createdAt: '2026-01-04T00:00:00.000Z',
    });
    await seedSpace(db, {
      id: FRIEND_SPACE,
      hostAccountId: FRIEND_ACCOUNT,
      visibility: 'friends',
      endedAt: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await seedSpace(db, {
      id: PRIVATE_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(db, {
      memberId: ACCOUNT_ID,
      spaceId: PRIVATE_SPACE,
      leftAt: null,
    });

    const publicIds = await queryIds(db, publicLiveSpaceIdsSql());
    expect(publicIds).toEqual([PUBLIC_SPACE]);
  });
});
