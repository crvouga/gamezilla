/**
 * A device's time in an account (`auth_account_devices`) is live exactly
 * while the device is signed in there. When the auth service leaves an
 * account with no sign-in method (Apple deleted its only Apple account), it
 * ends every session of it, so the server records every device as gone at
 * once; and a device that left an account hears so in its own copy.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { ChangedAuthUserResync } from '@libs/auth-server/changed-auth-user-resync';
import { LinkedIdentityMirror } from '@libs/auth-server/linked-identity-mirror';
import { AccountDeviceMembership } from '@libs/auth-shared/account-device-membership';
import { AnonUserService } from '@libs/auth-shared/anon-user-service';
import { ownAccountDevices } from '@libs/auth-shared/own-account-devices-query';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import type { AuthIdentity } from '@pkgs/auth-shared/auth-identity';
import type { AuthServerPort } from '@pkgs/auth-shared/auth-server-port';
import type { AuthUser } from '@pkgs/auth-shared/auth-user';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared/v2';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const adapters = createHarnessAdapters({ seed: 1 });
const time = { now: adapters.clock.now, createId: adapters.createId };

const PHONE = '11111111-1111-4111-8111-111111111111';
const TABLET = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_USER = 'ext_bob';

const APPLE: AuthIdentity = {
  provider: 'apple',
  providerUserId: 'apple-sub-bob',
  email: 'bob@icloud.com',
  emailVerified: true,
  isPrivateEmail: false,
  emailForwarding: true,
  name: 'Bob',
  linkedAt: '2024-06-01T00:00:00.000Z',
  lastSignInAt: null,
};

const GOOGLE: AuthIdentity = {
  ...APPLE,
  provider: 'google',
  providerUserId: 'google-sub-bob',
  email: 'bob@gmail.com',
};

function authServerListing(
  identities: readonly AuthIdentity[]
): AuthServerPort {
  const user: AuthUser = {
    externalUserId: EXTERNAL_USER,
    email: null,
    displayName: null,
    avatarUrl: null,
    identities,
  };
  return {
    provider: 'idp',
    deleteUser: () =>
      Promise.reject(new Error('deleteUser is outside this fixture')),
    verifySessionToken: async () => null,
    getUser: async () => user,
  };
}

async function signedInDevices(
  db: SqlClient,
  accountId: string
): Promise<readonly string[]> {
  const rows = await db.query(sql<{ readonly device_id: string }>`
    SELECT device_id FROM auth_account_devices
    WHERE user_id = ${accountId} AND deleted_at IS NULL
    ORDER BY device_id
  `);
  return rows.map((row) => row.device_id);
}

describe('a device signed out of an account is signed into it nowhere', () => {
  let db: SqlClient;
  let anonUsers: AnonUserService;

  /** Bob's account, signed in with Apple on his phone and his tablet. */
  async function bobOnTwoDevices(): Promise<string> {
    const { userId: account } = await anonUsers.ensureForDevice({
      deviceId: PHONE,
    });
    await anonUsers.clearUserAnonFlag(account, time.now);
    await db.run(sql<void>`
      INSERT INTO auth_external_accounts (id, user_id, provider, external_id, metadata, created_at)
      VALUES (${`idp:${EXTERNAL_USER}`}, ${account}, 'idp', ${EXTERNAL_USER}, '{}', ${new Date(time.now()).toISOString()})
    `);
    await new LinkedIdentityMirror(db, time).mirror(account, [APPLE]);
    const devices = new AccountDeviceMembership(db, time);
    for (const deviceId of [PHONE, TABLET]) {
      await devices.move({
        deviceId,
        fromAccountId: null,
        toUserId: account,
        toIsAccount: true,
      });
    }
    return account;
  }

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await reconcileSqliteSchema(db, registerTables([...AUTH_TABLES]));
    anonUsers = new AnonUserService(db, adapters);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  // regression: forced-sign-out-stale-device-row
  test('an account left with no sign-in method has no device signed into it', async () => {
    const account = await bobOnTwoDevices();
    expect(await signedInDevices(db, account)).toEqual([PHONE, TABLET]);

    await new ChangedAuthUserResync(db, authServerListing([]), time).resync(
      EXTERNAL_USER
    );

    expect(await signedInDevices(db, account)).toEqual([]);
  });

  test('an account that keeps a sign-in method keeps its devices', async () => {
    const account = await bobOnTwoDevices();

    await new ChangedAuthUserResync(
      db,
      authServerListing([GOOGLE]),
      time
    ).resync(EXTERNAL_USER);

    expect(await signedInDevices(db, account)).toEqual([PHONE, TABLET]);
  });

  // regression: forced-sign-out-stale-device-row
  test('a device that left an account receives its own tombstone there', async () => {
    const account = await bobOnTwoDevices();
    const { userId: guest } = await anonUsers.ensureForDevice({
      deviceId: PHONE,
    });

    const tables = await ownAccountDevices.run(
      {
        db: { query: (q) => db.query(q as Sql<QueryRow>) },
        env: {
          actorId: guest,
          deviceId: PHONE,
          accountId: null,
          isAnon: true,
          now: () => new Date(time.now()),
        },
      },
      {}
    );

    expect(tables['auth_account_devices']).toEqual([
      expect.objectContaining({
        user_id: account,
        device_id: PHONE,
        deleted_at: expect.any(String),
      }),
    ]);
  });
});
