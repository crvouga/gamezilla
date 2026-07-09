import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { AuthUserProfile } from '@pkgs/auth/shared/user-profile';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';

import {
  AccountCol,
  AccountProviderCol,
  AccountSessionCol,
  ACCOUNTS_TABLE,
  ACCOUNT_PROVIDERS_TABLE,
  ACCOUNT_SESSIONS_TABLE,
  DEVICES_TABLE,
  DeviceCol,
} from '@libs/auth/shared/auth-tables';

import { refreshAuthSnapshot } from './refresh-auth-snapshot';

function makeFakeAuthServer(args: {
  providerLabel?: string;
  session?: VerifiedSession | null;
  profile?: AuthUserProfile | null;
  verifyThrows?: boolean;
  profileThrows?: boolean;
}): AuthServerPort {
  const providerLabel = args.providerLabel ?? 'clerk';
  const session = args.session ?? null;
  const profile = args.profile ?? null;
  return {
    providerLabel,
    verifySessionToken: async () => {
      if (args.verifyThrows === true) {
        throw new Error('boom');
      }
      return session;
    },
    getUserProfile: async () => {
      if (args.profileThrows === true) {
        throw new Error('boom');
      }
      return profile;
    },
  };
}

async function migrateAuthTables(sql: SqlClient): Promise<void> {
  await sql.run(
    `CREATE TABLE ${DEVICES_TABLE.tableName} (
      ${DeviceCol.id} TEXT PRIMARY KEY,
      ${DeviceCol.createdAt} TEXT,
      ${DeviceCol.platform} TEXT,
      ${DeviceCol.osName} TEXT,
      ${DeviceCol.osVersion} TEXT,
      ${DeviceCol.deviceModelName} TEXT,
      ${DeviceCol.deviceBrand} TEXT,
      ${DeviceCol.deviceName} TEXT,
      ${DeviceCol.appVersion} TEXT,
      ${DeviceCol.appBuildNumber} TEXT,
      ${DeviceCol.userAgent} TEXT,
      ${DeviceCol.firstSeenAt} TEXT,
      ${DeviceCol.lastSeenAt} TEXT
    )`
  );
  await sql.run(
    `CREATE TABLE ${ACCOUNTS_TABLE.tableName} (
      ${AccountCol.id} TEXT PRIMARY KEY,
      ${AccountCol.createdAt} TEXT NOT NULL,
      ${AccountCol.stripeCustomerId} TEXT
    )`
  );
  await sql.run(
    `CREATE TABLE ${ACCOUNT_PROVIDERS_TABLE.tableName} (
      ${AccountProviderCol.id} TEXT PRIMARY KEY,
      ${AccountProviderCol.accountId} TEXT NOT NULL,
      ${AccountProviderCol.provider} TEXT,
      ${AccountProviderCol.providerUserId} TEXT,
      ${AccountProviderCol.email} TEXT,
      ${AccountProviderCol.linkedAt} TEXT
    )`
  );
  await sql.run(
    `CREATE TABLE ${ACCOUNT_SESSIONS_TABLE.tableName} (
      ${AccountSessionCol.id} TEXT PRIMARY KEY,
      ${AccountSessionCol.deviceId} TEXT NOT NULL,
      ${AccountSessionCol.accountId} TEXT NOT NULL,
      ${AccountSessionCol.token} TEXT NOT NULL,
      ${AccountSessionCol.expiresAt} TEXT,
      ${AccountSessionCol.createdAt} TEXT
    )`
  );
}

async function readAllProviders(
  sql: SqlClient,
  accountId: string
): Promise<
  ReadonlyArray<{
    provider: string;
    providerUserId: string;
    email: string | null;
  }>
> {
  const rows = await sql.query<{
    provider: string | null;
    provider_user_id: string | null;
    email: string | null;
  }>(
    `SELECT provider, provider_user_id, email FROM ${ACCOUNT_PROVIDERS_TABLE.tableName}
     WHERE ${AccountProviderCol.accountId} = ?`,
    [accountId]
  );
  return rows.map((row) => ({
    provider: row.provider ?? '',
    providerUserId: row.provider_user_id ?? '',
    email: row.email,
  }));
}

async function readSessions(sql: SqlClient): Promise<
  ReadonlyArray<{
    deviceId: string;
    accountId: string;
    token: string;
    expiresAt: string | null;
  }>
> {
  const rows = await sql.query<{
    device_id: string;
    account_id: string;
    token: string;
    expires_at: string | null;
  }>(`SELECT device_id, account_id, token, expires_at FROM ${ACCOUNT_SESSIONS_TABLE.tableName}`);
  return rows.map((row) => ({
    deviceId: row.device_id,
    accountId: row.account_id,
    token: row.token,
    expiresAt: row.expires_at,
  }));
}

async function readDevice(
  sql: SqlClient,
  deviceId: string
): Promise<{
  platform: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
} | null> {
  const rows = await sql.query<{
    platform: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
  }>(
    `SELECT platform, first_seen_at, last_seen_at FROM ${DEVICES_TABLE.tableName}
     WHERE ${DeviceCol.id} = ?`,
    [deviceId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  return {
    platform: row.platform,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function seedAccount(sql: SqlClient, accountId: string): Promise<void> {
  await sql.run(
    `INSERT INTO ${ACCOUNTS_TABLE.tableName} (${AccountCol.id}, ${AccountCol.createdAt})
     VALUES (?, ?)`,
    [accountId, new Date('2024-01-01').toISOString()]
  );
}

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_USER_ID = 'user_external_1';

async function assertProviders(
  sql: SqlClient,
  expected: ReadonlyArray<{
    provider: string;
    providerUserId: string;
    email: string | null;
  }>
): Promise<void> {
  const providers = await readAllProviders(sql, ACCOUNT_ID);
  expect(providers).toEqual([...expected]);
}

async function assertSession(
  sql: SqlClient,
  expected: { token: string; expiresAt: string }
): Promise<void> {
  const sessions = await readSessions(sql);
  expect(sessions).toEqual([
    {
      deviceId: DEVICE_ID,
      accountId: ACCOUNT_ID,
      token: expected.token,
      expiresAt: expected.expiresAt,
    },
  ]);
}

async function assertDevicePresent(sql: SqlClient): Promise<void> {
  const device = await readDevice(sql, DEVICE_ID);
  expect(device).not.toBeNull();
  expect(device?.platform).toBe('web');
}

const DEVICE_ATTRS: Record<string, string | null> = {
  [DeviceCol.platform]: 'web',
  [DeviceCol.osName]: 'macOS',
  [DeviceCol.osVersion]: '14.0',
  [DeviceCol.appVersion]: '1.0.0',
};

describe('refreshAuthSnapshot', () => {
  let sql: SqlClient;

  beforeEach(async () => {
    sql = SqlClientImplBunSqlite.open(':memory:');
    await sql.connect();
    await migrateAuthTables(sql);
    await seedAccount(sql, ACCOUNT_ID);
  });

  afterEach(async () => {
    await sql.disconnect();
  });

  test('inserts session, device, and provider rows on first run', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: 'alice@example.com',
        expiresAt: null,
      },
    });

    await refreshAuthSnapshot({
      sql,
      authServer,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    await assertProviders(sql, [
      {
        provider: 'clerk',
        providerUserId: EXTERNAL_USER_ID,
        email: 'alice@example.com',
      },
    ]);
    await assertSession(sql, {
      token: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    await assertDevicePresent(sql);
  });

  test('idempotent: running twice yields a single session/device/provider row', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: 'alice@example.com',
        expiresAt: null,
      },
    });

    const inputs = {
      sql,
      authServer,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    };

    await refreshAuthSnapshot(inputs);
    await refreshAuthSnapshot(inputs);

    expect(await readAllProviders(sql, ACCOUNT_ID)).toHaveLength(1);
    expect(await readSessions(sql)).toHaveLength(1);
    const device = await readDevice(sql, DEVICE_ID);
    expect(device).not.toBeNull();
  });

  test('rotates account/session.token on subsequent run with a new bearer', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: null,
        expiresAt: null,
      },
    });

    await refreshAuthSnapshot({
      sql,
      authServer,
      bearerToken: 'token-old',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    await refreshAuthSnapshot({
      sql,
      authServer,
      bearerToken: 'token-new',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-06-01T00:00:00.000Z',
    });

    await assertSession(sql, {
      token: 'token-new',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });
  });

  test('updates provider email from getUserProfile when session email is null', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: null,
        expiresAt: null,
      },
      profile: {
        externalUserId: EXTERNAL_USER_ID,
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: null,
      },
    });

    await refreshAuthSnapshot({
      sql,
      authServer,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    await assertProviders(sql, [
      {
        provider: 'clerk',
        providerUserId: EXTERNAL_USER_ID,
        email: 'alice@example.com',
      },
    ]);
  });

  test('survives verifySessionToken / getUserProfile failures', async () => {
    const authServer = makeFakeAuthServer({
      verifyThrows: true,
      profileThrows: true,
    });

    await refreshAuthSnapshot({
      sql,
      authServer,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await readAllProviders(sql, ACCOUNT_ID)).toHaveLength(0);
    expect(await readSessions(sql)).toHaveLength(1);
    expect(await readDevice(sql, DEVICE_ID)).not.toBeNull();
  });
});
