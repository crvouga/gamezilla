import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';
import { AnonUserService } from '../../public/anon-user-service';
import { EnsureInternalAccountUseCase } from '../../public/ensure-internal-account-use-case';
import { AUTH_TABLES } from '../../public/schema';
import { EnsureAnonUserUseCase } from './ensure-anon-user-use-case';

const adapters = createHarnessAdapters({ seed: 1 });

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_B = '22222222-2222-4222-8222-222222222222';

async function migrate(db: SqlClient): Promise<void> {
  await reconcileSqliteSchema(db, registerTables([...AUTH_TABLES]));
}

describe('AnonUserService', () => {
  let db: SqlClient;
  let ensureAnon: EnsureAnonUserUseCase;
  let anonUsers: AnonUserService;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrate(db);
    ensureAnon = new EnsureAnonUserUseCase(db, adapters);
    anonUsers = new AnonUserService(db, adapters);
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
    await anonUsers.clearUserAnonFlag(first.userId, adapters.clock.now);

    const next = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    expect(next.userId).not.toBe(first.userId);
    expect(await anonUsers.findUserIdByDeviceId(DEVICE_ID)).toBe(next.userId);
  });

  // regression: signed-out-device-stays-listed
  test('a device leaving an account tombstones its membership there', async () => {
    const first = await ensureAnon.execute({ deviceId: DEVICE_ID });
    await anonUsers.clearUserAnonFlag(first.userId, adapters.clock.now);

    const next = await ensureAnon.execute({ deviceId: DEVICE_ID });

    expect(next.leftAccountIds).toEqual([first.userId]);
    const rows = await db.query(sql<{ deleted_at: string | null }>`
      SELECT deleted_at FROM auth_account_devices
      WHERE user_id = ${first.userId} AND device_id = ${DEVICE_ID}
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).not.toBeNull();
  });

  test('a guest device leaves no account behind', async () => {
    const first = await ensureAnon.execute({ deviceId: DEVICE_ID });
    const next = await ensureAnon.execute({
      deviceId: DEVICE_ID,
      forceNew: true,
    });
    expect(next.userId).not.toBe(first.userId);
    expect(next.leftAccountIds).toEqual([]);
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

  test('unbound device adopts a client-proposed user id', async () => {
    const proposed = '33333333-3333-4333-8333-333333333333';
    const result = await ensureAnon.execute({
      deviceId: DEVICE_ID,
      userId: proposed,
    });
    expect(result.userId).toBe(proposed);
    expect(await anonUsers.findUserIdByDeviceId(DEVICE_ID)).toBe(proposed);
  });

  test('already-bound device ignores a different proposed user id', async () => {
    const first = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const next = await ensureAnon.execute({
      deviceId: DEVICE_ID,
      userId: '33333333-3333-4333-8333-333333333333',
    });
    expect(next.userId).toBe(first.userId);
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
    ensureAnon = new EnsureAnonUserUseCase(db, adapters);
    anonUsers = new AnonUserService(db, adapters);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  test('upgrades anon user in place when external id is new', async () => {
    const anon = await ensureAnon.execute({
      deviceId: DEVICE_ID,
    });
    const authServer: AuthServerPort = {
      provider: 'idp',
      deleteUser: () => Promise.reject(new Error('deleteUser is outside this fixture')),
    verifySessionToken: async () => null,
      getUser: async () => null,
    };

    const accountId = await new EnsureInternalAccountUseCase(
      db,
      adapters,
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
    await anonUsers.clearUserAnonFlag(other.userId, adapters.clock.now);
    const now = new Date(adapters.clock.now()).toISOString();
    await db.run(sql<void>`
      INSERT INTO auth_external_accounts (id, user_id, provider, external_id, metadata, created_at)
      VALUES (${'idp:ext_existing'}, ${other.userId}, 'idp', 'ext_existing', '{}', ${now})
    `);

    const authServer: AuthServerPort = {
      provider: 'idp',
      deleteUser: () => Promise.reject(new Error('deleteUser is outside this fixture')),
    verifySessionToken: async () => null,
      getUser: async () => null,
    };

    const accountId = await new EnsureInternalAccountUseCase(
      db,
      adapters,
      authServer
    ).execute({
      externalUserId: 'ext_existing',
      upgradeUserId: anon.userId,
    });
    expect(accountId).toBe(other.userId);
    expect(accountId).not.toBe(anon.userId);
  });
});
