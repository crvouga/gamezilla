import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server';
import type { AuthUser, VerifiedSession } from '@pkgs/auth/shared';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

import { AUTH_TABLES } from '../../public/schema';
import { AuthSnapshotRefresher } from './refresh-auth-snapshot';

const adapters = createHarnessAdapters({ seed: 1 });

const PRIMARY_AUTH_PROVIDER = 'idp';

function makeFakeAuthServer(args: {
  provider?: string;
  session?: VerifiedSession | null;
  user?: AuthUser | null;
  verifyThrows?: boolean;
  userThrows?: boolean;
}): AuthServerPort {
  const provider = args.provider ?? PRIMARY_AUTH_PROVIDER;
  const session = args.session ?? null;
  const user = args.user ?? null;
  return {
    provider,
    deleteUser: () => Promise.reject(new Error('deleteUser is outside this fixture')),
    verifySessionToken: async () => {
      if (args.verifyThrows === true) {
        throw new Error('boom');
      }
      return session;
    },
    getUser: async () => {
      if (args.userThrows === true) {
        throw new Error('boom');
      }
      return user;
    },
  };
}

async function migrateAuthTables(db: SqlClient): Promise<void> {
  await reconcileSqliteSchema(db, registerTables([...AUTH_TABLES]));
}

async function readPrimaryAuthExternalAccount(
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
    FROM auth_external_accounts
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
    FROM auth_devices
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
    FROM auth_devices
    WHERE id = ${deviceId}
  `);
  return rows[0] ?? null;
}

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_USER_ID = 'user_external_1';

const AUTH_USER: AuthUser = {
  externalUserId: EXTERNAL_USER_ID,
  email: 'alice@example.com',
  displayName: null,
  avatarUrl: null,
  identities: [],
};

const DEVICE_ATTRS: Record<string, string | null> = {
  platform: 'web',
  os_name: 'macOS',
  os_version: '14.0',
  app_version: '1.0.0',
};

describe('AuthSnapshotRefresher', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateAuthTables(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('mirrors primary auth external account and binds device on first run', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: 'alice@example.com',
        expiresAt: null,
        authenticatedAt: null,
      },
      user: AUTH_USER,
    });

    await new AuthSnapshotRefresher(sqlClient, authServer).refresh({
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      now: adapters.clock.now,
      createId: adapters.createId,
    });

    const primary = await readPrimaryAuthExternalAccount(sqlClient, ACCOUNT_ID);
    expect(primary?.external_id).toBe(EXTERNAL_USER_ID);
    const metadata = JSON.parse(primary!.metadata!) as Record<string, unknown>;
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
        authenticatedAt: null,
      },
      user: AUTH_USER,
    });

    const refresher = new AuthSnapshotRefresher(sqlClient, authServer);
    const inputs = {
      bearerToken: 'token-1',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      now: adapters.clock.now,
      createId: adapters.createId,
    };

    await refresher.refresh(inputs);
    await refresher.refresh(inputs);

    const rows = await sqlClient.query(sql<{ external_id: string }>`
      SELECT external_id
      FROM auth_external_accounts
      WHERE provider = ${PRIMARY_AUTH_PROVIDER}
    `);
    expect(rows).toHaveLength(1);
    expect(await readDevice(sqlClient, DEVICE_ID)).not.toBeNull();
  });

  test('updates primary auth metadata without removing other external_account rows', async () => {
    const authServer = makeFakeAuthServer({
      session: {
        externalUserId: EXTERNAL_USER_ID,
        accountId: null,
        email: null,
        expiresAt: null,
        authenticatedAt: null,
      },
      user: AUTH_USER,
    });

    const now = new Date(adapters.clock.now()).toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO auth_external_accounts (
        id,
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (${'billing:cus_1'}, ${ACCOUNT_ID}, ${'billing'}, ${'cus_1'}, ${'{}'}, ${now})
    `);

    await new AuthSnapshotRefresher(sqlClient, authServer).refresh({
      bearerToken: 'token-new',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      now: adapters.clock.now,
      createId: adapters.createId,
    });

    const billingRows = await sqlClient.query(sql<{
      external_id: string | null;
    }>`
      SELECT external_id
      FROM auth_external_accounts
      WHERE user_id = ${ACCOUNT_ID}
        AND provider = ${'billing'}
    `);
    expect(billingRows[0]?.external_id).toBe('cus_1');

    const primaryRows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM auth_external_accounts
      WHERE user_id = ${ACCOUNT_ID}
        AND provider = ${PRIMARY_AUTH_PROVIDER}
    `);
    const metadata = JSON.parse(primaryRows[0]!.metadata) as Record<
      string,
      unknown
    >;
    expect(metadata['email']).toBe('alice@example.com');
  });

  test('survives verifySessionToken / getUser failures', async () => {
    const authServer = makeFakeAuthServer({
      verifyThrows: true,
      userThrows: true,
    });

    await new AuthSnapshotRefresher(sqlClient, authServer).refresh({
      bearerToken: 'token',
      accountId: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      deviceAttributes: DEVICE_ATTRS,
      now: adapters.clock.now,
      createId: adapters.createId,
    });

    expect(
      await readPrimaryAuthExternalAccount(sqlClient, ACCOUNT_ID)
    ).toBeUndefined();
    expect(await readDeviceUserId(sqlClient, DEVICE_ID)).toBe(ACCOUNT_ID);
    expect(await readDevice(sqlClient, DEVICE_ID)).not.toBeNull();
  });

  // regression: signed-out-device-stays-listed
  test('signing the device into another account takes it off the first', async () => {
    const OTHER_ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
    for (const id of [ACCOUNT_ID, OTHER_ACCOUNT_ID]) {
      await sqlClient.run(sql`
        INSERT INTO auth_users (id, created_at, updated_at, is_anon)
        VALUES (${id}, '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z', false)
      `);
    }
    const refresher = new AuthSnapshotRefresher(
      sqlClient,
      makeFakeAuthServer({ session: null })
    );
    const signInAs = (accountId: string) =>
      refresher.refresh({
        bearerToken: 'token-1',
        accountId,
        deviceId: DEVICE_ID,
        deviceAttributes: DEVICE_ATTRS,
        now: adapters.clock.now,
        createId: adapters.createId,
      });

    expect(await signInAs(ACCOUNT_ID)).toEqual([]);
    expect(await signInAs(OTHER_ACCOUNT_ID)).toEqual([ACCOUNT_ID]);

    const rows = await sqlClient.query(sql<{
      user_id: string;
      deleted_at: string | null;
    }>`
      SELECT user_id, deleted_at FROM auth_account_devices
      WHERE device_id = ${DEVICE_ID}
      ORDER BY user_id
    `);
    expect(rows.map((row) => [row.user_id, row.deleted_at === null])).toEqual([
      [ACCOUNT_ID, false],
      [OTHER_ACCOUNT_ID, true],
    ]);
  });
});
