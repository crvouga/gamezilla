import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_USERS_TABLE,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { runRules } from '@pkgs/rules/core/run-rules';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { createSpace } from '../shared/create-space/create-space-write';
import {
  authorizeJoinSpace,
  executeJoinSpace,
} from '../shared/join-space/join-space-write';
import {
  authorizeLeaveSpace,
  executeLeaveSpace,
} from '../shared/leave-space/leave-space-write';
import { requireAccountId } from '../shared/space-write-helpers';

const SPACE_ID = 'space-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const GUEST_DEVICE_ID = 'device-guest-cccc-2222';
const GUEST_ACCOUNT_ID = 'account-guest-dddd-3333';

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

function ctx(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
}): AppRulesAuth {
  return {
    userId: args.accountId ?? args.deviceId,
    deviceId: args.deviceId,
    accountId: args.accountId,
  };
}

async function seedHostSpace(db: SqlClient): Promise<void> {
  const now = new Date().toISOString();
  await db.run(sql<void>`
    INSERT INTO spaces (
      id, host_id, host_member_id, host_account_id, visibility, created_at
    )
    VALUES (
      ${SPACE_ID},
      ${DEVICE_ID},
      ${ACCOUNT_ID},
      ${ACCOUNT_ID},
      ${'private'},
      ${now}
    )
  `);
  await db.run(sql<void>`
    INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
    VALUES (
      ${spaceUserEntityId(SPACE_ID, ACCOUNT_ID)},
      ${SPACE_ID},
      ${ACCOUNT_ID},
      ${now},
      ${ACCOUNT_ID}
    )
  `);
}

async function readSpaceUser(db: SqlClient, userId: string): Promise<boolean> {
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id
    FROM space_users
    WHERE id = ${spaceUserEntityId(SPACE_ID, userId)}
  `);
  return rows.length > 0;
}

async function readSpaceHost(db: SqlClient): Promise<{
  readonly hostMemberId: string | null;
  readonly hostAccountId: string | null;
  readonly endedAt: string | null;
}> {
  const rows = await db.query(sql<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly ended_at: string | null;
  }>`
    SELECT host_member_id, host_account_id, ended_at
    FROM spaces
    WHERE id = ${SPACE_ID}
  `);
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
    try {
      await authorizeLeaveSpace(anon, { spaceId: SPACE_ID }, db);
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
      if (isRulesReject(error)) {
        expect(error.failures[0]?.code).toBe('SPACE_NOT_SIGNED_IN');
      }
    }
  });

  test('signed-in host leave ends the space', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await authorizeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(await readSpaceUser(db, ACCOUNT_ID)).toBe(true);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();
  });

  test('host leave with guest space_user ends the space', async () => {
    const now = new Date().toISOString();
    await db.run(sql<void>`
      INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
      VALUES (
        ${spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID)},
        ${SPACE_ID},
        ${GUEST_ACCOUNT_ID},
        ${now},
        ${ACCOUNT_ID}
      )
    `);
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(await readSpaceUser(db, GUEST_ACCOUNT_ID)).toBe(true);
    expect((await readSpaceHost(db)).endedAt).not.toBeNull();
  });

  test('guest leave keeps space live and retains space_users', async () => {
    const now = new Date().toISOString();
    await db.run(sql<void>`
      INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
      VALUES (
        ${spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID)},
        ${SPACE_ID},
        ${GUEST_ACCOUNT_ID},
        ${now},
        ${ACCOUNT_ID}
      )
    `);
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

    await db.run(sql<void>`
      UPDATE spaces
      SET ended_at = NULL, host_member_id = ${DEVICE_ID}, host_account_id = NULL
    `);
    await authorizeJoinSpace(signedIn, { spaceId: SPACE_ID }, db);
    await executeJoinSpace(signedIn, { spaceId: SPACE_ID }, db);
    expect(await readSpaceUser(db, ACCOUNT_ID)).toBe(true);
    const space = await readSpaceHost(db);
    expect(space.hostMemberId).toBe(ACCOUNT_ID);
    expect(space.hostAccountId).toBe(ACCOUNT_ID);
    expect(space.endedAt).toBeNull();
  });

  test('anonymous join is rejected', async () => {
    const anon = ctx({ deviceId: GUEST_DEVICE_ID, accountId: null });
    try {
      await authorizeJoinSpace(anon, { spaceId: SPACE_ID }, db);
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
      if (isRulesReject(error)) {
        expect(error.failures[0]?.code).toBe('SPACE_NOT_SIGNED_IN');
      }
    }
  });

  test('anonymous create is rejected', async () => {
    const anon = ctx({ deviceId: DEVICE_ID, accountId: null });
    try {
      requireAccountId(anon);
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
      if (isRulesReject(error)) {
        expect(error.failures[0]?.code).toBe('SPACE_NOT_SIGNED_IN');
      }
    }
    try {
      await createSpace(
        anon,
        { spaceId: 'space-new', visibility: 'private' },
        db
      );
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
    }
  });
});

describe('space_users rules auth', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedHostSpace(db);
  });

  test('allows host to delete a guest space_users row', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await runRules(
      {
        phase: 'before',
        auth: signedIn,
        db,
        batch: {
          rows: [
            {
              op: 'delete',
              table: SPACE_USERS_TABLE.tableName,
              id: spaceUserEntityId(SPACE_ID, GUEST_ACCOUNT_ID),
            },
          ],
        },
      },
      SPACE_RULES
    );
  });

  test('rejects guest managing another user space_users row', async () => {
    const guest = ctx({
      deviceId: GUEST_DEVICE_ID,
      accountId: GUEST_ACCOUNT_ID,
    });
    try {
      await runRules(
        {
          phase: 'before',
          auth: guest,
          db,
          batch: {
            rows: [
              {
                op: 'delete',
                table: SPACE_USERS_TABLE.tableName,
                id: spaceUserEntityId(SPACE_ID, ACCOUNT_ID),
              },
            ],
          },
        },
        SPACE_RULES
      );
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
    }
  });

  test('allows create-time self ACL when space row is not on server yet', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const newSpaceId = 'space-new-create';
    await runRules(
      {
        phase: 'before',
        auth: signedIn,
        db,
        batch: {
          rows: [
            {
              op: 'put',
              table: SPACE_USERS_TABLE.tableName,
              id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
              values: {
                id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
                space_id: newSpaceId,
                user_id: ACCOUNT_ID,
                created_by_account_id: ACCOUNT_ID,
              },
            },
          ],
        },
      },
      SPACE_RULES
    );
  });

  test('rejects create-time self ACL when created_by mismatches', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const newSpaceId = 'space-new-create';
    try {
      await runRules(
        {
          phase: 'before',
          auth: signedIn,
          db,
          batch: {
            rows: [
              {
                op: 'put',
                table: SPACE_USERS_TABLE.tableName,
                id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
                values: {
                  id: spaceUserEntityId(newSpaceId, ACCOUNT_ID),
                  space_id: newSpaceId,
                  user_id: ACCOUNT_ID,
                  created_by_account_id: GUEST_ACCOUNT_ID,
                },
              },
            ],
          },
        },
        SPACE_RULES
      );
      expect(true).toBe(false);
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
    }
  });
});
