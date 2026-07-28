import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceMembershipEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  friendsLiveSpaceIdsSql,
  hostedUnleftSpacesSelectSql,
} from '../client/my-live-space-seat-sql';
import { buildCurrentSpaceEntries } from '../client/use-current-space-ids';

const HOST_SPACE = 'space-host-1';
const FRIEND_SPACE = 'space-friend-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const FRIEND_ACCOUNT = 'account-friend-cccc-2222';

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
}

async function migrate(sql: SqlClient): Promise<void> {
  await sql.run(
    `CREATE TABLE ${SPACES_TABLE.tableName} (
      ${SpaceCol.id} TEXT PRIMARY KEY,
      ${SpaceCol.title} TEXT,
      ${SpaceCol.hostId} TEXT,
      ${SpaceCol.createdAt} TEXT,
      ${SpaceCol.endedAt} TEXT,
      ${SpaceCol.visibility} TEXT,
      ${SpaceCol.hostAccountId} TEXT,
      ${SpaceCol.hostMemberId} TEXT,
      ${SpaceCol.activeMemberCount} INTEGER NOT NULL DEFAULT 0
    )`
  );
  await sql.run(
    `CREATE TABLE ${SPACE_MEMBERSHIPS_TABLE.tableName} (
      ${SpaceMembershipCol.id} TEXT PRIMARY KEY,
      ${SpaceMembershipCol.memberId} TEXT,
      ${SpaceMembershipCol.spaceId} TEXT,
      ${SpaceMembershipCol.joinedAt} TEXT,
      ${SpaceMembershipCol.leftAt} TEXT,
      ${SpaceMembershipCol.profileId} TEXT
    )`
  );
}

async function seedSpace(
  sql: SqlClient,
  args: {
    readonly id: string;
    readonly hostAccountId: string;
    readonly visibility: string;
    readonly endedAt: string | null;
    readonly createdAt: string;
  }
): Promise<void> {
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.hostMemberId},
      ${SpaceCol.hostAccountId}, ${SpaceCol.visibility},
      ${SpaceCol.endedAt}, ${SpaceCol.createdAt},
      ${SpaceCol.activeMemberCount})
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      args.id,
      DEVICE_ID,
      args.hostAccountId,
      args.hostAccountId,
      args.visibility,
      args.endedAt,
      args.createdAt,
    ]
  );
}

async function seedMembership(
  sql: SqlClient,
  args: {
    readonly memberId: string;
    readonly spaceId: string;
    readonly leftAt: string | null;
  }
): Promise<void> {
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
      ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
      ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      spaceMembershipEntityId(args.memberId, args.spaceId),
      args.memberId,
      args.spaceId,
      '2026-01-01T00:00:00.000Z',
      args.leftAt,
      args.memberId,
    ]
  );
}

async function queryIds(sql: SqlClient, query: {
  readonly sql: string;
  readonly params: readonly string[];
}): Promise<string[]> {
  const rows = await sql.query<{ readonly id: string }>(
    query.sql,
    [...query.params]
  );
  return rows.map((r) => r.id);
}

describe('my-live-space-seat-sql — left_at before ended_at', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
  });

  test('left host seat is excluded from friends list and hosted miniplayer set', async () => {
    await seedSpace(sql, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(sql, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: '2026-01-02T01:00:00.000Z',
    });

    const friendsIds = await queryIds(
      sql,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).not.toContain(HOST_SPACE);

    const hostedQuery = hostedUnleftSpacesSelectSql(ACCOUNT_ID);
    const hosted = await sql.query<{
      readonly id: string;
      readonly host_member_id: string | null;
      readonly host_account_id: string | null;
      readonly ended_at: string | null;
    }>(hostedQuery.sql, [...hostedQuery.params]);
    expect(hosted.map((r) => r.id)).not.toContain(HOST_SPACE);

    const entries = buildCurrentSpaceEntries([], [], hosted, ACCOUNT_ID);
    expect(entries.map((e) => e.spaceId)).not.toContain(HOST_SPACE);
  });

  test('active host seat is included in friends list and hosted miniplayer set', async () => {
    await seedSpace(sql, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(sql, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: null,
    });

    const friendsIds = await queryIds(
      sql,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).toContain(HOST_SPACE);

    const hostedQuery = hostedUnleftSpacesSelectSql(ACCOUNT_ID);
    const hosted = await sql.query<{
      readonly id: string;
      readonly host_member_id: string | null;
      readonly host_account_id: string | null;
      readonly ended_at: string | null;
    }>(hostedQuery.sql, [...hostedQuery.params]);
    expect(hosted.map((r) => r.id)).toContain(HOST_SPACE);

    const entries = buildCurrentSpaceEntries(
      [HOST_SPACE],
      hosted,
      hosted,
      ACCOUNT_ID
    );
    expect(entries.map((e) => e.spaceId)).toContain(HOST_SPACE);
  });

  test('friends-visibility space hosted by someone else still appears', async () => {
    await seedSpace(sql, {
      id: FRIEND_SPACE,
      hostAccountId: FRIEND_ACCOUNT,
      visibility: 'friends',
      endedAt: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await seedSpace(sql, {
      id: HOST_SPACE,
      hostAccountId: ACCOUNT_ID,
      visibility: 'friends',
      endedAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await seedMembership(sql, {
      memberId: ACCOUNT_ID,
      spaceId: HOST_SPACE,
      leftAt: '2026-01-02T01:00:00.000Z',
    });

    const friendsIds = await queryIds(
      sql,
      friendsLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(friendsIds).toContain(FRIEND_SPACE);
    expect(friendsIds).not.toContain(HOST_SPACE);
  });
});
