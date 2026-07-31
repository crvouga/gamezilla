import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SPACES_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { ident, sql, sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
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

async function seedHostSpace(db: SqlClient): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    sqlMap({
      insertInto: SPACES_TABLE.tableName,
      values: {
        [SpaceCol.id]: SPACE_ID,
        [SpaceCol.hostId]: DEVICE_ID,
        [SpaceCol.hostMemberId]: ACCOUNT_ID,
        [SpaceCol.hostAccountId]: ACCOUNT_ID,
        [SpaceCol.visibility]: 'private',
        [SpaceCol.createdAt]: now,
      },
    })
  );
  await db.run(
    sqlMap({
      insertInto: SPACE_USERS_TABLE.tableName,
      values: {
        [SpaceUserCol.id]: spaceUserEntityId(SPACE_ID, ACCOUNT_ID),
        [SpaceUserCol.spaceId]: SPACE_ID,
        [SpaceUserCol.userId]: ACCOUNT_ID,
        [SpaceUserCol.createdAt]: now,
        [SpaceUserCol.createdByAccountId]: ACCOUNT_ID,
      },
    })
  );
}

async function readSpaceUser(db: SqlClient, userId: string): Promise<boolean> {
  const rows = await db.query<{ readonly id: string }>(
    sqlMap({
      select: [SpaceUserCol.id],
      from: SPACE_USERS_TABLE.tableName,
      where: ['=', SpaceUserCol.id, spaceUserEntityId(SPACE_ID, userId)],
    })
  );
  return rows.length > 0;
}

async function readSpaceHost(db: SqlClient): Promise<{
  readonly hostMemberId: string | null;
  readonly hostAccountId: string | null;
  readonly endedAt: string | null;
}> {
  const rows = await db.query<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly ended_at: string | null;
  }>(
    sqlMap({
      select: [SpaceCol.hostMemberId, SpaceCol.hostAccountId, SpaceCol.endedAt],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, SPACE_ID],
    })
  );
  const row = rows[0]!;
  return {
    hostMemberId: row.host_member_id,
    hostAccountId: row.host_account_id,
    endedAt: row.ended_at,
  };
}

describe('leave / join / create require account', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedHostSpace(db);
  });

  test('anonymous leave is rejected', async () => {
    const anon = ctx({ deviceId: DEVICE_ID, accountId: null });
    const auth = await authorizeLeaveSpace(anon, { spaceId: SPACE_ID }, db);
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.code).toBe('SPACE_NOT_SIGNED_IN');
    }
  });

  test('signed-in host leave ends the space', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const auth = await authorizeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(auth.ok).toBe(true);
    const exec = await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(exec.ok).toBe(true);
    expect(await readSpaceUser(db, ACCOUNT_ID)).toBe(true);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();
  });

  test('host leave with guest space_user ends the space', async () => {
    const now = new Date().toISOString();
    await db.run(
      sqlMap({
        insertInto: SPACE_USERS_TABLE.tableName,
        values: {
          [SpaceUserCol.id]: spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID),
          [SpaceUserCol.spaceId]: SPACE_ID,
          [SpaceUserCol.userId]: GUEST_ACCOUNT_ID,
          [SpaceUserCol.createdAt]: now,
          [SpaceUserCol.createdByAccountId]: ACCOUNT_ID,
        },
      })
    );
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(await readSpaceUser(db, GUEST_ACCOUNT_ID)).toBe(true);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();
  });

  test('guest leave keeps space live and retains space_users', async () => {
    const now = new Date().toISOString();
    await db.run(
      sqlMap({
        insertInto: SPACE_USERS_TABLE.tableName,
        values: {
          [SpaceUserCol.id]: spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID),
          [SpaceUserCol.spaceId]: SPACE_ID,
          [SpaceUserCol.userId]: GUEST_ACCOUNT_ID,
          [SpaceUserCol.createdAt]: now,
          [SpaceUserCol.createdByAccountId]: ACCOUNT_ID,
        },
      })
    );
    const guest = ctx({
      deviceId: GUEST_DEVICE_ID,
      accountId: GUEST_ACCOUNT_ID,
    });
    await executeLeaveSpace(guest, { spaceId: SPACE_ID }, db);
    expect(await readSpaceUser(db, GUEST_ACCOUNT_ID)).toBe(true);
    expect(await readSpaceUser(db, ACCOUNT_ID)).toBe(true);
    expect((await readSpaceHost(db)).endedAt).toBeNull();
  });

  test('host can rejoin private space and heal identity', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();

    await db.run(
      sqlMap({
        update: SPACES_TABLE.tableName,
        set: {
          [SpaceCol.endedAt]: null,
          [SpaceCol.hostMemberId]: DEVICE_ID,
          [SpaceCol.hostAccountId]: null,
        },
      })
    );
    const auth = await authorizeJoinSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(auth.ok).toBe(true);
    const exec = await executeJoinSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(exec.ok).toBe(true);
    expect(await readSpaceUser(db, ACCOUNT_ID)).toBe(true);
    const space = await readSpaceHost(db);
    expect(space.hostMemberId).toBe(ACCOUNT_ID);
    expect(space.hostAccountId).toBe(ACCOUNT_ID);
    expect(space.endedAt).toBeNull();
  });

  test('anonymous join is rejected', async () => {
    const anon = ctx({ deviceId: GUEST_DEVICE_ID, accountId: null });
    const auth = await authorizeJoinSpace(anon, { spaceId: SPACE_ID }, db);
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

describe('space_users upload auth', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedHostSpace(db);
  });

  test('allows host to delete a guest space_users row', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const binding = SPACE_ROW_BINDINGS[SPACE_USERS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'delete',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID),
        values: {},
      },
      db
    );
    expect(result.ok).toBe(true);
  });

  test('rejects guest managing another user space_users row', async () => {
    const guest = ctx({
      deviceId: GUEST_DEVICE_ID,
      accountId: GUEST_ACCOUNT_ID,
    });
    const binding = SPACE_ROW_BINDINGS[SPACE_USERS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      guest,
      {
        op: 'delete',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(SPACE_ID, ACCOUNT_ID),
        values: {},
      },
      db
    );
    expect(result.ok).toBe(false);
  });

  test('allows create-time self ACL when space row is not on server yet', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const binding = SPACE_ROW_BINDINGS[SPACE_USERS_TABLE.tableName]!;
    const newSpaceId = 'space-new-create';
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'put',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
        values: {
          [SpaceUserCol.id]: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
          [SpaceUserCol.spaceId]: newSpaceId,
          [SpaceUserCol.userId]: ACCOUNT_ID,
          [SpaceUserCol.createdByAccountId]: ACCOUNT_ID,
        },
      },
      db
    );
    expect(result.ok).toBe(true);
  });

  test('rejects create-time self ACL when created_by mismatches', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const binding = SPACE_ROW_BINDINGS[SPACE_USERS_TABLE.tableName]!;
    const newSpaceId = 'space-new-create';
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'put',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
        values: {
          [SpaceUserCol.id]: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
          [SpaceUserCol.spaceId]: newSpaceId,
          [SpaceUserCol.userId]: ACCOUNT_ID,
          [SpaceUserCol.createdByAccountId]: GUEST_ACCOUNT_ID,
        },
      },
      db
    );
    expect(result.ok).toBe(false);
  });
});
