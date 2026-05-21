import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@gamezilla/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import {
  PATCHES_DB_SYSTEM_CONTEXT,
  type PatchDb,
} from '@gamezilla/patch-db/interface';

import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
  ACCOUNT_ENTITY_TYPE,
} from '@gamezilla/auth/shared';

import type { HostedBetterAuth } from './better-auth-create';
import { refreshAuthSnapshot } from './refresh-auth-snapshot';

type LinkedAccount = {
  providerId: string;
  accountId: string;
  createdAt?: string;
};

function makeFakeAuth(args: {
  email?: string;
  linked?: ReadonlyArray<LinkedAccount>;
}): HostedBetterAuth {
  const email = args.email;
  const linked = args.linked ?? [];
  return {
    handler: async () => new Response(),
    api: {
      getSession: async () =>
        email !== undefined ? { user: { email } } : null,
      listUserAccounts: async () =>
        linked.map((entry) => ({
          providerId: entry.providerId,
          accountId: entry.accountId,
          createdAt: entry.createdAt ?? new Date('2024-01-01').toISOString(),
        })),
    },
  };
}

async function readAllProviders(
  db: PatchDb,
  accountId: string
): Promise<
  ReadonlyArray<{
    provider: string;
    providerUserId: string;
    email: string | null;
  }>
> {
  const [res] = await db.read(
    [
      {
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountProviderAttr.accountId.key,
          value: accountId,
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return (res?.entities ?? []).map((ent) => ({
    provider: AccountProviderAttr.provider.from(ent.attributes) ?? '',
    providerUserId:
      AccountProviderAttr.providerUserId.from(ent.attributes) ?? '',
    email: AccountProviderAttr.email.from(ent.attributes),
  }));
}

async function readSessions(db: PatchDb): Promise<
  ReadonlyArray<{
    deviceId: string;
    accountId: string;
    token: string;
    expiresAt: string | null;
  }>
> {
  const [res] = await db.read(
    [{ entityType: ACCOUNT_SESSION_ENTITY_TYPE }],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return (res?.entities ?? []).map((ent) => ({
    deviceId: AccountSessionAttr.deviceId.from(ent.attributes),
    accountId: AccountSessionAttr.accountId.from(ent.attributes),
    token: AccountSessionAttr.token.from(ent.attributes),
    expiresAt: AccountSessionAttr.expiresAt.from(ent.attributes),
  }));
}

async function readDevice(
  db: PatchDb,
  deviceId: string
): Promise<{
  platform: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
} | null> {
  const [res] = await db.read(
    [{ entityType: DEVICE_ENTITY_TYPE, entityId: deviceId }],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  const ent = res?.entities[0];
  if (ent === undefined) return null;
  return {
    platform: DeviceAttr.platform.from(ent.attributes),
    firstSeenAt: DeviceAttr.firstSeenAt.from(ent.attributes),
    lastSeenAt: DeviceAttr.lastSeenAt.from(ent.attributes),
  };
}

async function seedAccount(db: PatchDb, accountId: string): Promise<void> {
  await db.write(
    [
      {
        entityId: accountId,
        entityType: ACCOUNT_ENTITY_TYPE,
        attributes: {
          ...AccountAttr.id(accountId),
          ...AccountAttr.createdAt(new Date('2024-01-01').toISOString()),
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
}

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';

async function assertProviders(
  db: PatchDb,
  expected: ReadonlyArray<{
    provider: string;
    providerUserId: string;
    email: string | null;
  }>
): Promise<void> {
  const providers = await readAllProviders(db, ACCOUNT_ID);
  expect(providers).toEqual([...expected]);
}

async function assertSession(
  db: PatchDb,
  expected: { token: string; expiresAt: string }
): Promise<void> {
  const sessions = await readSessions(db);
  expect(sessions).toEqual([
    {
      deviceId: DEVICE_ID,
      accountId: ACCOUNT_ID,
      token: expected.token,
      expiresAt: expected.expiresAt,
    },
  ]);
}

async function assertDevicePresent(db: PatchDb): Promise<void> {
  const device = await readDevice(db, DEVICE_ID);
  expect(device).not.toBeNull();
  expect(device?.platform).toBe('web');
}

const DEVICE_ATTRS: Record<string, string> = {
  [DeviceAttr.platform.key]: 'web',
  [DeviceAttr.osName.key]: 'macOS',
  [DeviceAttr.osVersion.key]: '14.0',
  [DeviceAttr.appVersion.key]: '1.0.0',
};

describe('refreshAuthSnapshot', () => {
  let client: SqlClient;
  let db: PatchDb;

  beforeEach(async () => {
    client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    const sqliteDb = new PatchDbImplSqlite(client);
    await sqliteDb.migrate();
    db = sqliteDb;
    await seedAccount(db, ACCOUNT_ID);
  });

  afterEach(async () => {
    await client.disconnect();
  });

  test('inserts session, device, and provider rows on first run', async () => {
    const auth = makeFakeAuth({
      email: 'alice@example.com',
      linked: [{ providerId: 'google', accountId: 'google-user-1' }],
    });

    await refreshAuthSnapshot({
      db,
      auth,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    await assertProviders(db, [
      {
        provider: 'google',
        providerUserId: 'google-user-1',
        email: 'alice@example.com',
      },
    ]);
    await assertSession(db, {
      token: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    await assertDevicePresent(db);
  });

  test('idempotent: running twice yields a single session/device/provider row', async () => {
    const auth = makeFakeAuth({
      email: 'alice@example.com',
      linked: [{ providerId: 'google', accountId: 'google-user-1' }],
    });

    const inputs = {
      db,
      auth,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    };

    await refreshAuthSnapshot(inputs);
    await refreshAuthSnapshot(inputs);

    expect(await readAllProviders(db, ACCOUNT_ID)).toHaveLength(1);
    expect(await readSessions(db)).toHaveLength(1);
    const device = await readDevice(db, DEVICE_ID);
    expect(device).not.toBeNull();
  });

  test('rotates account/session.token on subsequent run with a new bearer', async () => {
    const auth = makeFakeAuth({ linked: [] });

    await refreshAuthSnapshot({
      db,
      auth,
      bearerToken: 'token-old',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    await refreshAuthSnapshot({
      db,
      auth,
      bearerToken: 'token-new',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-06-01T00:00:00.000Z',
    });

    await assertSession(db, {
      token: 'token-new',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });
  });

  test('newly linked provider is added without duplicating existing rows', async () => {
    const authBefore = makeFakeAuth({
      email: 'alice@example.com',
      linked: [{ providerId: 'google', accountId: 'g-1' }],
    });
    await refreshAuthSnapshot({
      db,
      auth: authBefore,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    const authAfter = makeFakeAuth({
      email: 'alice@example.com',
      linked: [
        { providerId: 'google', accountId: 'g-1' },
        { providerId: 'apple', accountId: 'a-1' },
      ],
    });
    await refreshAuthSnapshot({
      db,
      auth: authAfter,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    const providers = await readAllProviders(db, ACCOUNT_ID);
    expect(providers).toHaveLength(2);
    const providerIds = providers.map((p) => p.provider).sort();
    expect(providerIds).toEqual(['apple', 'google']);
  });

  test('survives Better Auth getSession / listUserAccounts failures', async () => {
    const auth: HostedBetterAuth = {
      handler: async () => new Response(),
      api: {
        getSession: async () => {
          throw new Error('boom');
        },
        listUserAccounts: async () => {
          throw new Error('boom');
        },
      },
    };

    await refreshAuthSnapshot({
      db,
      auth,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      accountSessionExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await readAllProviders(db, ACCOUNT_ID)).toHaveLength(0);
    expect(await readSessions(db)).toHaveLength(1);
    expect(await readDevice(db, DEVICE_ID)).not.toBeNull();
  });
});
