import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { createSimIo } from '@pkgs/io';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { AnonUserService } from './anon-user-service';
import { EnsureAnonUserUseCase } from './ensure-anon-user-use-case';
import { EnsureInternalAccountUseCase } from './ensure-internal-account-use-case';

const io = createSimIo({ seed: 1 });

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_B = '22222222-2222-4222-8222-222222222222';

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE auth_users (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      is_anon INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE auth_devices (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      user_id TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE auth_external_accounts (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      UNIQUE (provider, external_id),
      UNIQUE (user_id, provider)
    )
  `);
}

describe('AnonUserService', () => {
  let db: SqlClient;
  let ensureAnon: EnsureAnonUserUseCase;
  let anonUsers: AnonUserService;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrate(db);
    ensureAnon = new EnsureAnonUserUseCase(db, io);
    anonUsers = new AnonUserService(db, io);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  test('mints anon user and binds device', async () => {
    const result = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    expect(result.isAnon).toBe(true);
    expect(result.userId.length).toBeGreaterThan(0);
    expect(await anonUsers.findUserIdByDeviceId(DEVICE_ID)).toBe(result.userId);

    const rows = await db.query(sql<{ is_anon: number }>`
      SELECT is_anon FROM auth_users WHERE id = ${result.userId}
    `);
    expect(rows[0]?.is_anon).toBe(1);
  });

  test('idempotent when already bound to anon user', async () => {
    const first = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const second = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    expect(second.userId).toBe(first.userId);
  });

  test('mints new anon when device was bound to non-anon user', async () => {
    const first = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    await anonUsers.clearUserAnonFlag(first.userId, io.clock.now);

    const next = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    expect(next.userId).not.toBe(first.userId);
    expect(await anonUsers.findUserIdByDeviceId(DEVICE_ID)).toBe(next.userId);
  });

  test('forceNew always mints a new anon user', async () => {
    const first = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const next = await ensureAnon.execute({
      deviceId: DEVICE_ID,
      forceNew: true,
    });
    expect(next.userId).not.toBe(first.userId);
  });
});

describe('AccountProvisioningService upgrade', () => {
  let db: SqlClient;
  let ensureAnon: EnsureAnonUserUseCase;
  let anonUsers: AnonUserService;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrate(db);
    ensureAnon = new EnsureAnonUserUseCase(db, io);
    anonUsers = new AnonUserService(db, io);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  test('upgrades anon user in place when external id is new', async () => {
    const anon = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const authServer: AuthServerPort = {
      providerLabel: 'better-auth',
      verifySessionToken: async () => null,
      getUserProfile: async () => null,
      getUserSnapshot: async () => ({ id: 'ext_1' }),
    };

    const accountId = await new EnsureInternalAccountUseCase(
      db,
      io,
      authServer
    ).execute({
      externalUserId: 'ext_1',
      upgradeUserId: anon.userId,
    });
    expect(accountId).toBe(anon.userId);

    const rows = await db.query(sql<{ is_anon: number }>`
      SELECT is_anon FROM auth_users WHERE id = ${accountId}
    `);
    expect(rows[0]?.is_anon).toBe(0);
  });

  test('switches to existing linked account instead of upgrading', async () => {
    const anon = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const other = await ensureAnon.execute({
      deviceId: DEVICE_B,
    });
    await anonUsers.clearUserAnonFlag(other.userId, io.clock.now);
    const now = new Date(io.clock.now()).toISOString();
    await db.run(sql<void>`
      INSERT INTO auth_external_accounts (id, user_id, provider, external_id, metadata, created_at)
      VALUES (${'better-auth:ext_existing'}, ${other.userId}, 'better-auth', 'ext_existing', '{}', ${now})
    `);

    const authServer: AuthServerPort = {
      providerLabel: 'better-auth',
      verifySessionToken: async () => null,
      getUserProfile: async () => null,
      getUserSnapshot: async () => ({ id: 'ext_existing' }),
    };

    const accountId = await new EnsureInternalAccountUseCase(
      db,
      io,
      authServer
    ).execute({
      externalUserId: 'ext_existing',
      upgradeUserId: anon.userId,
    });
    expect(accountId).toBe(other.userId);
    expect(accountId).not.toBe(anon.userId);
  });
});
