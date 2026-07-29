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
import { honey, sql, ident } from '@pkgs/sql';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { createSpaceWrite } from '../shared/create-space/create-space-write';
import {
  authorizeJoinSpace,
  executeJoinSpace,
} from '../shared/join-space/join-space-write';
import {
  authorizeLeaveSpace,
  executeLeaveSpace,
} from '../shared/leave-space/leave-space-write';
import { SPACE_ROW_BINDINGS } from '../shared/row-bindings';

const SPACE_ID = 'space-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const GUEST_DEVICE_ID = 'device-guest-cccc-2222';
const GUEST_ACCOUNT_ID = 'account-guest-dddd-3333';

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

function ctx(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
}): WriteContext {
  const myId = args.accountId ?? args.deviceId;
  return {
    subjectId: myId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    myId,
    isAnonymous: args.accountId === null,
    memberOfSpaceIds: [],
  };
}

async function seedHostMembership(db: SqlClient): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    honey({
      insertInto: SPACES_TABLE.tableName,
      values: {
        [SpaceCol.id]: SPACE_ID,
        [SpaceCol.hostId]: DEVICE_ID,
        [SpaceCol.hostMemberId]: ACCOUNT_ID,
        [SpaceCol.hostAccountId]: ACCOUNT_ID,
        [SpaceCol.visibility]: 'private',
        [SpaceCol.activeMemberCount]: 1,
      },
    })
  );
  await db.run(
    honey({
      insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
      values: {
        [SpaceMembershipCol.id]: spaceMembershipEntityId(ACCOUNT_ID, SPACE_ID),
        [SpaceMembershipCol.memberId]: ACCOUNT_ID,
        [SpaceMembershipCol.spaceId]: SPACE_ID,
        [SpaceMembershipCol.joinedAt]: now,
        [SpaceMembershipCol.leftAt]: null,
        [SpaceMembershipCol.profileId]: ACCOUNT_ID,
      },
    })
  );
}

async function readMembership(
  db: SqlClient,
  memberId: string
): Promise<{ readonly leftAt: string | null } | null> {
  const id = spaceMembershipEntityId(memberId, SPACE_ID);
  const rows = await db.query<{ readonly left_at: string | null }>(
    honey({
      select: [SpaceMembershipCol.leftAt],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, id],
    })
  );
  const row = rows[0];
  if (row === undefined) return null;
  return { leftAt: row.left_at };
}

async function readSpaceHost(db: SqlClient): Promise<{
  readonly hostMemberId: string | null;
  readonly hostAccountId: string | null;
  readonly activeMemberCount: number;
  readonly endedAt: string | null;
}> {
  const rows = await db.query<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly active_member_count: number;
    readonly ended_at: string | null;
  }>(
    honey({
      select: [
        SpaceCol.hostMemberId,
        SpaceCol.hostAccountId,
        SpaceCol.activeMemberCount,
        SpaceCol.endedAt,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, SPACE_ID],
    })
  );
  const row = rows[0]!;
  return {
    hostMemberId: row.host_member_id,
    hostAccountId: row.host_account_id,
    activeMemberCount: Number(row.active_member_count),
    endedAt: row.ended_at,
  };
}

describe('leave / join / create require account membership', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedHostMembership(db);
  });

  test('anonymous leave is rejected', async () => {
    const anon = ctx({ deviceId: DEVICE_ID, accountId: null });
    const auth = await authorizeLeaveSpace(anon, { spaceId: SPACE_ID }, db);
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.code).toBe('SPACE_NOT_SIGNED_IN');
    }
  });

  test('signed-in leave clears account membership and ends empty space', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const auth = await authorizeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(auth.ok).toBe(true);
    const exec = await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(exec.ok).toBe(true);
    expect((await readMembership(db, ACCOUNT_ID))?.leftAt).not.toBeNull();
    const space = await readSpaceHost(db);
    expect(space.activeMemberCount).toBe(0);
    expect(space.endedAt).not.toBeNull();
  });

  test('host leave with guest remaining ends the space', async () => {
    const now = new Date().toISOString();
    await db.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: spaceMembershipEntityId(
            GUEST_ACCOUNT_ID,
            SPACE_ID
          ),
          [SpaceMembershipCol.memberId]: GUEST_ACCOUNT_ID,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.joinedAt]: now,
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.profileId]: GUEST_ACCOUNT_ID,
        },
      })
    );
    await db.run(
      honey({
        update: SPACES_TABLE.tableName,
        set: { [SpaceCol.activeMemberCount]: 2 },
      })
    );
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect((await readMembership(db, ACCOUNT_ID))?.leftAt).not.toBeNull();
    expect((await readMembership(db, GUEST_ACCOUNT_ID))?.leftAt).toBeNull();
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();
  });

  test('guest leave with host remaining keeps space live', async () => {
    const now = new Date().toISOString();
    await db.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: spaceMembershipEntityId(
            GUEST_ACCOUNT_ID,
            SPACE_ID
          ),
          [SpaceMembershipCol.memberId]: GUEST_ACCOUNT_ID,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.joinedAt]: now,
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.profileId]: GUEST_ACCOUNT_ID,
        },
      })
    );
    await db.run(
      honey({
        update: SPACES_TABLE.tableName,
        set: { [SpaceCol.activeMemberCount]: 2 },
      })
    );
    const guest = ctx({
      deviceId: GUEST_DEVICE_ID,
      accountId: GUEST_ACCOUNT_ID,
    });
    await executeLeaveSpace(guest, { spaceId: SPACE_ID }, db);
    expect((await readMembership(db, GUEST_ACCOUNT_ID))?.leftAt).not.toBeNull();
    expect((await readMembership(db, ACCOUNT_ID))?.leftAt).toBeNull();
    expect((await readSpaceHost(db)).endedAt).toBeNull();
  });

  test('host can rejoin private space and heal identity', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();

    await db.run(
      honey({
        update: SPACES_TABLE.tableName,
        set: {
          [SpaceCol.endedAt]: null,
          [SpaceCol.hostMemberId]: DEVICE_ID,
          [SpaceCol.hostAccountId]: null,
          [SpaceCol.activeMemberCount]: 0,
        },
      })
    );
    const auth = await authorizeJoinSpace(
      signedIn,
      { spaceId: SPACE_ID, inviteToken: null },
      db
    );
    expect(auth.ok).toBe(true);
    const exec = await executeJoinSpace(
      signedIn,
      { spaceId: SPACE_ID, inviteToken: null },
      db
    );
    expect(exec.ok).toBe(true);
    expect((await readMembership(db, ACCOUNT_ID))?.leftAt).toBeNull();
    const space = await readSpaceHost(db);
    expect(space.hostMemberId).toBe(ACCOUNT_ID);
    expect(space.hostAccountId).toBe(ACCOUNT_ID);
    expect(space.endedAt).toBeNull();
  });

  test('anonymous join is rejected', async () => {
    const anon = ctx({ deviceId: GUEST_DEVICE_ID, accountId: null });
    const auth = await authorizeJoinSpace(
      anon,
      { spaceId: SPACE_ID, inviteToken: null },
      db
    );
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.code).toBe('SPACE_NOT_SIGNED_IN');
    }
  });

  test('anonymous create is rejected', async () => {
    const anon = ctx({ deviceId: DEVICE_ID, accountId: null });
    const auth = await createSpaceWrite.authorize(
      anon,
      { spaceId: 'space-new', visibility: 'private' },
      db
    );
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.code).toBe('SPACE_NOT_SIGNED_IN');
    }
  });
});

describe('membership leave upload auth', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedHostMembership(db);
  });

  test('allows leave-shaped membership for own account', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const binding = SPACE_ROW_BINDINGS[SPACE_MEMBERSHIPS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'patch',
        table: SPACE_MEMBERSHIPS_TABLE.tableName,
        id: spaceMembershipEntityId(ACCOUNT_ID, SPACE_ID),
        values: {
          [SpaceMembershipCol.memberId]: ACCOUNT_ID,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.leftAt]: new Date().toISOString(),
        },
      },
      db
    );
    expect(result.ok).toBe(true);
  });

  test('rejects leave-shaped membership for unrelated member', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const other = 'other-member-cccc';
    const binding = SPACE_ROW_BINDINGS[SPACE_MEMBERSHIPS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'patch',
        table: SPACE_MEMBERSHIPS_TABLE.tableName,
        id: spaceMembershipEntityId(other, SPACE_ID),
        values: {
          [SpaceMembershipCol.memberId]: other,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.leftAt]: new Date().toISOString(),
        },
      },
      db
    );
    expect(result.ok).toBe(false);
  });
});
