import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { ensureInternalAccountIdForExternalUser } from './account-provisioning';
import {
  clearUserAnonFlag,
  ensureAnonUserForDevice,
  findUserIdByDeviceId,
} from './anon-user-ensure';

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_B = '22222222-2222-4222-8222-222222222222';

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      is_anon INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE devices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE external_accounts (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, external_id),
      UNIQUE (user_id, provider)
    )
  `);
}

describe('ensureAnonUserForDevice', () => {
  let db: SqlClient;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrate(db);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  test('mints anon user and binds device', async () => {
    const result = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    expect(result.isAnon).toBe(true);
    expect(result.userId.length).toBeGreaterThan(0);
    expect(await findUserIdByDeviceId(db, DEVICE_ID)).toBe(result.userId);

    const rows = await db.query(sql<{ is_anon: number }>`
      SELECT is_anon FROM users WHERE id = ${result.userId}
    `);
    expect(rows[0]?.is_anon).toBe(1);
  });

  test('idempotent when already bound to anon user', async () => {
    const first = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    const second = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    expect(second.userId).toBe(first.userId);
  });

  test('mints new anon when device was bound to non-anon user', async () => {
    const first = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    await clearUserAnonFlag(db, first.userId);

    const next = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    expect(next.userId).not.toBe(first.userId);
    expect(await findUserIdByDeviceId(db, DEVICE_ID)).toBe(next.userId);
  });

  test('forceNew always mints a new anon user', async () => {
    const first = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    const next = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
      forceNew: true,
    });
    expect(next.userId).not.toBe(first.userId);
  });
});

describe('ensureInternalAccountIdForExternalUser upgrade', () => {
  let db: SqlClient;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrate(db);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  test('upgrades anon user in place when external id is new', async () => {
    const anon = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    const authServer: AuthServerPort = {
      providerLabel: 'clerk',
      verifySessionToken: async () => null,
      getUserProfile: async () => null,
      getUserSnapshot: async () => ({ id: 'ext_1' }),
    };

    const accountId = await ensureInternalAccountIdForExternalUser({
      sql: db,
      authServer,
      externalUserId: 'ext_1',
      upgradeUserId: anon.userId,
    });
    expect(accountId).toBe(anon.userId);

    const rows = await db.query(sql<{ is_anon: number }>`
      SELECT is_anon FROM users WHERE id = ${accountId}
    `);
    expect(rows[0]?.is_anon).toBe(0);
  });

  test('switches to existing linked account instead of upgrading', async () => {
    const anon = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_ID,
    });
    const other = await ensureAnonUserForDevice({
      sql: db,
      deviceId: DEVICE_B,
    });
    await clearUserAnonFlag(db, other.userId);
    const now = new Date().toISOString();
    await db.run(sql<void>`
      INSERT INTO external_accounts (user_id, provider, external_id, metadata, created_at)
      VALUES (${other.userId}, 'clerk', 'ext_existing', '{}', ${now})
    `);

    const authServer: AuthServerPort = {
      providerLabel: 'clerk',
      verifySessionToken: async () => null,
      getUserProfile: async () => null,
      getUserSnapshot: async () => ({ id: 'ext_existing' }),
    };

    const accountId = await ensureInternalAccountIdForExternalUser({
      sql: db,
      authServer,
      externalUserId: 'ext_existing',
      upgradeUserId: anon.userId,
    });
    expect(accountId).toBe(other.userId);
    expect(accountId).not.toBe(anon.userId);
  });
});
