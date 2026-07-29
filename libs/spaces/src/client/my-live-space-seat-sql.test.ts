import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_ALLOWLIST_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceAllowlistCol,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  spaceAllowlistEntityId,
} from '@libs/db/shared/space-tables';
import { spaceMembershipEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, sql, type Sql, ident } from '@pkgs/sql';

import {
  myLiveSeatSpacesSelectSql,
  sharedLiveSpaceIdsSql,
} from '../client/my-live-space-seat-sql';
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
  await db.run(sql`CREATE TABLE ${ident(SPACE_ALLOWLIST_TABLE.tableName)} (
      ${ident(SpaceAllowlistCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceAllowlistCol.spaceId)} TEXT,
      ${ident(SpaceAllowlistCol.userId)} TEXT,
      ${ident(SpaceAllowlistCol.createdAt)} TEXT,
      ${ident(SpaceAllowlistCol.createdByAccountId)} TEXT
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

async function seedAllowlist(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<void> {
  await db.run(
    honey({
      insertInto: SPACE_ALLOWLIST_TABLE.tableName,
      values: {
        [SpaceAllowlistCol.id]: spaceAllowlistEntityId(spaceId, userId),
        [SpaceAllowlistCol.spaceId]: spaceId,
        [SpaceAllowlistCol.userId]: userId,
        [SpaceAllowlistCol.createdAt]: '2026-01-01T00:00:00.000Z',
        [SpaceAllowlistCol.createdByAccountId]: OTHER_ACCOUNT,
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

  test('left host seat is excluded from shared list and miniplayer seats', async () => {
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

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    // Host member id still matches even without an active seat.
    expect(sharedIds).toContain(HOST_SPACE);

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

  test('active host seat is included in shared list and miniplayer seats', async () => {
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

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(sharedIds).toContain(HOST_SPACE);

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

  test('allowlisted private space appears in shared list', async () => {
    await seedSpace(db, {
      id: SHARED_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      visibility: 'private',
      endedAt: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await seedAllowlist(db, SHARED_SPACE, ACCOUNT_ID);

    const sharedIds = await queryIds(
      db,
      sharedLiveSpaceIdsSql({
        memberId: ACCOUNT_ID,
        includeHostAccountId: true,
      })
    );
    expect(sharedIds).toContain(SHARED_SPACE);
  });
});
