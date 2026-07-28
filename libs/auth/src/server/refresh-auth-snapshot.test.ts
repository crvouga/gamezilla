import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { raw, sql } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';
import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';

import { DEVICES_TABLE, DeviceCol } from '@libs/db/shared/auth-tables';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/db/shared/external-accounts-tables';
import { buildLinkedProviders } from '@libs/auth/shared/linked-account-providers';

import { refreshAuthSnapshot } from './refresh-auth-snapshot';

const PRIMARY_AUTH_PROVIDER = 'clerk';

function makeFakeAuthServer(args: {
  providerLabel?: string;
  session?: VerifiedSession | null;
  snapshot?: Record<string, unknown> | null;
  verifyThrows?: boolean;
  snapshotThrows?: boolean;
}): AuthServerPort {
  const providerLabel = args.providerLabel ?? PRIMARY_AUTH_PROVIDER;
  const session = args.session ?? null;
  const snapshot = args.snapshot ?? null;
  return {
    providerLabel,
    verifySessionToken: async () => {
      if (args.verifyThrows === true) {
        throw new Error('boom');
      }
      return session;
    },
    getUserProfile: async () => null,
    getUserSnapshot: async () => {
      if (args.snapshotThrows === true) {
        throw new Error('boom');
      }
      return snapshot;
    },
  };
}

async function migrateAuthTables(db: SqlClient): Promise<void> {
  await db.run(sql`
    CREATE TABLE ${raw(DEVICES_TABLE.tableName)} (
      ${raw(DeviceCol.id)} TEXT PRIMARY KEY,
      ${raw(DeviceCol.userId)} TEXT,
      ${raw(DeviceCol.createdAt)} TEXT,
      ${raw(DeviceCol.platform)} TEXT,
      ${raw(DeviceCol.osName)} TEXT,
      ${raw(DeviceCol.osVersion)} TEXT,
      ${raw(DeviceCol.deviceModelName)} TEXT,
      ${raw(DeviceCol.deviceBrand)} TEXT,
      ${raw(DeviceCol.deviceName)} TEXT,
      ${raw(DeviceCol.appVersion)} TEXT,
      ${raw(DeviceCol.appBuildNumber)} TEXT,
      ${raw(DeviceCol.userAgent)} TEXT,
      ${raw(DeviceCol.firstSeenAt)} TEXT,
      ${raw(DeviceCol.lastSeenAt)} TEXT
    )
  `);
  await db.run(sql`
    CREATE TABLE ${raw(EXTERNAL_ACCOUNTS_TABLE)} (
      ${raw(ExternalAccountCol.userId)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.provider)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.externalId)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.metadata)} TEXT NOT NULL DEFAULT '{}',
      ${raw(ExternalAccountCol.createdAt)} TEXT NOT NULL,
      PRIMARY KEY (${raw(ExternalAccountCol.provider)}, ${raw(ExternalAccountCol.externalId)}),
      UNIQUE (${raw(ExternalAccountCol.userId)}, ${raw(ExternalAccountCol.provider)})
    )
  `);
  await db.run(sql`
    CREATE TABLE ${raw(ENTITY_STORE_TABLE)} (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      owner_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (namespace, type, external_id)
    )
  `);
}

async function readClerkExternalAccount(
  db: SqlClient,
  accountId: string
): Promise<
  | {
      external_id: string | null;
      metadata: string | null;
      created_at: string | null;
    }
  | undefined
> {
  const rows = await db.query<{
    external_id: string | null;
    metadata: string | null;
    created_at: string | null;
  }>(sql`
    SELECT ${raw(ExternalAccountCol.externalId)} AS external_id,
           ${raw(ExternalAccountCol.metadata)} AS metadata,
           ${raw(ExternalAccountCol.createdAt)} AS created_at
    FROM ${raw(EXTERNAL_ACCOUNTS_TABLE)}
    WHERE ${raw(ExternalAccountCol.userId)} = ${accountId}
      AND ${raw(ExternalAccountCol.provider)} = ${PRIMARY_AUTH_PROVIDER}
    LIMIT 1
  `);
  return rows[0];
}

async function readClerkEntityStore(
  db: SqlClient,
  accountId: string
): Promise<{ data: string; created_at: string } | undefined> {
  const rows = await db.query<{ data: string; created_at: string }>(sql`
    SELECT data, created_at FROM ${raw(ENTITY_STORE_TABLE)}
    WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER} AND owner_id = ${accountId}
    LIMIT 1
  `);
  return rows[0];
}

function projectProviders(
  accountId: string,
  authExternalAccount: {
    external_id: string;
    metadata: string | null;
    created_at: string | null;
  },
  entity: { data: string; created_at: string } | undefined
) {
  const snapshot = entity?.data
    ? (JSON.parse(entity.data) as Record<string, unknown>)
    : null;
  return buildLinkedProviders({
    accountId,
    primaryAuthProvider: PRIMARY_AUTH_PROVIDER,
    primaryAuthExternalAccount: {
      externalId: authExternalAccount.external_id,
      metadata: authExternalAccount.metadata,
      createdAt: authExternalAccount.created_at ?? new Date(0).toISOString(),
    },
    authSnapshotData: snapshot,
    entityCreatedAt: entity?.created_at ?? null,
  }).map((row) => ({
    provider: row.provider,
    providerUserId: row.providerUserId,
    email: row.email,
  }));
}

async function readProviders(
  db: SqlClient,
  accountId: string
): Promise<
  ReadonlyArray<{
    provider: string;
    providerUserId: string;
    email: string | null;
  }>
> {
  const clerk = await readClerkExternalAccount(db, accountId);
  const externalId = clerk?.external_id;
  if (typeof externalId !== 'string' || externalId.length === 0) {
    return [];
  }
  const entity = await readClerkEntityStore(db, accountId);
  return projectProviders(
    accountId,
    {
      external_id: externalId,
      metadata: clerk?.metadata ?? null,
      created_at: clerk?.created_at ?? null,
    },
    entity
  );
}

async function readEntityStoreOwnerId(
  db: SqlClient,
  externalUserId: string
): Promise<string | null> {
  const rows = await db.query<{ owner_id: string | null }>(sql`
    SELECT owner_id FROM ${raw(ENTITY_STORE_TABLE)}
    WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER} AND external_id = ${externalUserId}
  `);
  return rows[0]?.owner_id ?? null;
}

async function readDeviceUserId(
  db: SqlClient,
  deviceId: string
): Promise<string | null> {
  const rows = await db.query<{ user_id: string | null }>(sql`
    SELECT ${raw(DeviceCol.userId)} AS user_id FROM ${raw(DEVICES_TABLE.tableName)}
    WHERE ${raw(DeviceCol.id)} = ${deviceId}
  `);
  return rows[0]?.user_id ?? null;
}

async function readDevice(
  db: SqlClient,
  deviceId: string
): Promise<{ platform: string | null } | null> {
  const rows = await db.query<{ platform: string | null }>(sql`
    SELECT platform FROM ${raw(DEVICES_TABLE.tableName)} WHERE ${raw(DeviceCol.id)} = ${deviceId}
  `);
  return rows[0] ?? null;
}

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_USER_ID = 'user_external_1';

const CLERK_SNAPSHOT = {
  id: EXTERNAL_USER_ID,
  primary_email: 'alice@example.com',
  email_addresses: [{ id: 'ea_1', email_address: 'alice@example.com' }],
  primary_email_address_id: 'ea_1',
  external_accounts: [],
};

const DEVICE_ATTRS: Record<string, string | null> = {
  [DeviceCol.platform]: 'web',
  [DeviceCol.osName]: 'macOS',
  [DeviceCol.osVersion]: '14.0',
  [DeviceCol.appVersion]: '1.0.0',
};

describe('refreshAuthSnapshot', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateAuthTables(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('mirrors clerk snapshot and binds device on first run', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: 'alice@example.com',
        expiresAt: null,
      },
      snapshot: CLERK_SNAPSHOT,
    });

    await refreshAuthSnapshot({
      sql: sqlClient,
      authServer,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
    });

    expect(await readEntityStoreOwnerId(sqlClient, EXTERNAL_USER_ID)).toBe(
      ACCOUNT_ID
    );
    expect(await readDeviceUserId(sqlClient, DEVICE_ID)).toBe(ACCOUNT_ID);
    expect(await readProviders(sqlClient, ACCOUNT_ID)).toEqual([
      {
        provider: PRIMARY_AUTH_PROVIDER,
        providerUserId: EXTERNAL_USER_ID,
        email: 'alice@example.com',
      },
    ]);
    expect((await readDevice(sqlClient, DEVICE_ID))?.platform).toBe('web');
  });

  test('idempotent: running twice yields one entity row and one device row', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: 'alice@example.com',
        expiresAt: null,
      },
      snapshot: CLERK_SNAPSHOT,
    });

    const inputs = {
      sql: sqlClient,
      authServer,
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
    };

    await refreshAuthSnapshot(inputs);
    await refreshAuthSnapshot(inputs);

    const rows = await sqlClient.query<{ id: string }>(sql`
      SELECT id FROM ${raw(ENTITY_STORE_TABLE)} WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER}
    `);
    expect(rows).toHaveLength(1);
    expect(await readDevice(sqlClient, DEVICE_ID)).not.toBeNull();
  });

  test('updates clerk metadata without removing other external_account rows', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: null,
        expiresAt: null,
      },
      snapshot: CLERK_SNAPSHOT,
    });

    const now = new Date().toISOString();
    await sqlClient.run(sql`
      INSERT INTO ${raw(EXTERNAL_ACCOUNTS_TABLE)}
      (${raw(ExternalAccountCol.userId)}, ${raw(ExternalAccountCol.provider)},
       ${raw(ExternalAccountCol.externalId)}, ${raw(ExternalAccountCol.metadata)},
       ${raw(ExternalAccountCol.createdAt)})
      VALUES (${ACCOUNT_ID}, 'stripe', 'cus_1', '{}', ${now})
    `);
    await sqlClient.run(sql`
      INSERT INTO ${raw(ENTITY_STORE_TABLE)}
      (id, namespace, type, external_id, owner_id, data, created_at, updated_at)
      VALUES ('auth/user/user_external_1', ${ENTITY_STORE_NAMESPACE_AUTH}, ${ENTITY_STORE_TYPE_USER}, ${EXTERNAL_USER_ID}, ${ACCOUNT_ID}, ${JSON.stringify({ id: EXTERNAL_USER_ID })}, ${now}, ${now})
    `);

    await refreshAuthSnapshot({
      sql: sqlClient,
      authServer,
      bearerToken: 'token-new',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
    });

    const stripeRows = await sqlClient.query<{
      external_id: string | null;
    }>(sql`
      SELECT ${raw(ExternalAccountCol.externalId)} AS external_id
      FROM ${raw(EXTERNAL_ACCOUNTS_TABLE)}
      WHERE ${raw(ExternalAccountCol.userId)} = ${ACCOUNT_ID} AND ${raw(ExternalAccountCol.provider)} = 'stripe'
    `);
    expect(stripeRows[0]?.external_id).toBe('cus_1');

    const clerkRows = await sqlClient.query<{ metadata: string }>(sql`
      SELECT ${raw(ExternalAccountCol.metadata)} AS metadata
      FROM ${raw(EXTERNAL_ACCOUNTS_TABLE)}
      WHERE ${raw(ExternalAccountCol.userId)} = ${ACCOUNT_ID} AND ${raw(ExternalAccountCol.provider)} = ${PRIMARY_AUTH_PROVIDER}
    `);
    const metadata = JSON.parse(clerkRows[0]!.metadata) as Record<
      string,
      unknown
    >;
    expect(metadata['email']).toBe('alice@example.com');
  });

  test('survives verifySessionToken / getUserSnapshot failures', async () => {
    const authServer = makeFakeAuthServer({
      verifyThrows: true,
      snapshotThrows: true,
    });

    await refreshAuthSnapshot({
      sql: sqlClient,
      authServer,
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
    });

    expect(
      await readEntityStoreOwnerId(sqlClient, EXTERNAL_USER_ID)
    ).toBeNull();
    expect(await readDeviceUserId(sqlClient, DEVICE_ID)).toBe(ACCOUNT_ID);
    expect(await readDevice(sqlClient, DEVICE_ID)).not.toBeNull();
  });
});
