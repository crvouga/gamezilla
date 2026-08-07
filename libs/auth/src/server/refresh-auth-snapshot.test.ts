import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

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
  await db.run(sql<void>`
    CREATE TABLE devices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      platform TEXT,
      os_name TEXT,
      os_version TEXT,
      device_model_name TEXT,
      device_brand TEXT,
      device_name TEXT,
      app_version TEXT,
      app_build_number TEXT,
      user_agent TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE external_accounts (
      id TEXT NOT NULL UNIQUE,
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

async function readClerkExternalAccount(
  db: SqlClient,
  accountId: string
): Promise<
  | {
      external_id: string | null;
      metadata: string | null;
    }
  | undefined
> {
  const rows = await db.query(sql<{
    external_id: string | null;
    metadata: string | null;
  }>`
    SELECT external_id, metadata
    FROM external_accounts
    WHERE user_id = ${accountId}
      AND provider = ${PRIMARY_AUTH_PROVIDER}
    LIMIT 1
  `);
  return rows[0];
}

async function readDeviceUserId(
  db: SqlClient,
  deviceId: string
): Promise<string | null> {
  const rows = await db.query(sql<{ user_id: string | null }>`
    SELECT user_id
    FROM devices
    WHERE id = ${deviceId}
  `);
  return rows[0]?.user_id ?? null;
}

async function readDevice(
  db: SqlClient,
  deviceId: string
): Promise<{ platform: string | null } | null> {
  const rows = await db.query(sql<{ platform: string | null }>`
    SELECT platform
    FROM devices
    WHERE id = ${deviceId}
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
  platform: 'web',
  os_name: 'macOS',
  os_version: '14.0',
  app_version: '1.0.0',
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

  test('mirrors clerk external account and binds device on first run', async () => {
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

    const clerk = await readClerkExternalAccount(sqlClient, ACCOUNT_ID);
    expect(clerk?.external_id).toBe(EXTERNAL_USER_ID);
    const metadata = JSON.parse(clerk!.metadata!) as Record<string, unknown>;
    expect(metadata['email']).toBe('alice@example.com');
    expect(await readDeviceUserId(sqlClient, DEVICE_ID)).toBe(ACCOUNT_ID);
    expect((await readDevice(sqlClient, DEVICE_ID))?.platform).toBe('web');
  });

  test('idempotent: running twice yields one external_account and one device row', async () => {
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

    const rows = await sqlClient.query(sql<{ external_id: string }>`
      SELECT external_id
      FROM external_accounts
      WHERE provider = ${PRIMARY_AUTH_PROVIDER}
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
    await sqlClient.run(sql<void>`
      INSERT INTO external_accounts (
        id,
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (${'stripe:cus_1'}, ${ACCOUNT_ID}, ${'stripe'}, ${'cus_1'}, ${'{}'}, ${now})
    `);

    await refreshAuthSnapshot({
      sql: sqlClient,
      authServer,
      bearerToken: 'token-new',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
    });

    const stripeRows = await sqlClient.query(sql<{
      external_id: string | null;
    }>`
      SELECT external_id
      FROM external_accounts
      WHERE user_id = ${ACCOUNT_ID}
        AND provider = ${'stripe'}
    `);
    expect(stripeRows[0]?.external_id).toBe('cus_1');

    const clerkRows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM external_accounts
      WHERE user_id = ${ACCOUNT_ID}
        AND provider = ${PRIMARY_AUTH_PROVIDER}
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
      await readClerkExternalAccount(sqlClient, ACCOUNT_ID)
    ).toBeUndefined();
    expect(await readDeviceUserId(sqlClient, DEVICE_ID)).toBe(ACCOUNT_ID);
    expect(await readDevice(sqlClient, DEVICE_ID)).not.toBeNull();
  });
});
