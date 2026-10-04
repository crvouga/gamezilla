import { expect, test } from 'bun:test';
import { AnonUserService } from '@libs/auth-shared/anon-user-service';
import { appAuth } from '@libs/auth-shared/auth-context';
import { SessionAuth } from '@libs/auth-shared/session-middleware';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import sql from '@pkgs/sql-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

test('stale deletion proof is rejected after the install gains a new anonymous owner; fresh proof works', async () => {
  // regression: deleted-device-bearer-rebound
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(AUTH_TABLES));
    const ports = createHarnessAdapters({ seed: 47 });
    const users = new AnonUserService(db, ports);
    const device = '11111111-1111-4111-8111-111111111147';
    const original = await users.ensureForDevice({ deviceId: device });
    await users.clearUserAnonFlag(original.userId, ports.clock.now);
    await db.run(
      sql`INSERT INTO auth_account_devices (id, user_id, device_id, created_at, updated_at) VALUES (${'historical-alice-device'}, ${original.userId}, ${device}, ${'2026-09-30T00:00:00.000Z'}, ${'2026-09-30T00:00:00.000Z'})`
    );
    await db.run(
      sql`UPDATE auth_users SET deleted_at = ${'2026-10-01T00:00:00.000Z'} WHERE id = ${original.userId}`
    );
    await db.run(
      sql`UPDATE auth_devices SET deleted_at = ${'2026-10-01T00:00:00.000Z'} WHERE id = ${device}`
    );
    const replacement = await users.ensureForDevice({ deviceId: device });
    expect(replacement.userId).not.toBe(original.userId);
    const auth = new SessionAuth(
      {
        provider: 'idp',
        verifySessionToken: (token) =>
          Promise.resolve(
            token === 'fresh-proof'
              ? {
                  externalUserId: 'new-alice-identity',
                  accountId: null,
                  email: null,
                  expiresAt: null,
                  authenticatedAt: new Date('2026-10-01T00:00:00.000Z'),
                }
              : null
          ),
        getUser: async () => null,
        deleteUser: async () => {},
      },
      ports
    );
    const request = (token: string, path = 'mutations') =>
      new Request(`http://test/api/${path}`, {
        method: 'POST',
        headers: { 'x-anon-id': device, Authorization: `Bearer ${token}` },
      });
    expect(await auth.resolveAuthContext(db, request('deleted-proof'))).toEqual(
      { accountDeleted: true }
    );
    expect(
      appAuth(
        await auth.resolveAuthContext(db, request('deleted-proof', 'query'))
      )
    ).toMatchObject({ accountId: replacement.userId });
    expect(
      appAuth(await auth.resolveAuthContext(db, request('fresh-proof')))
    ).toMatchObject({ accountId: replacement.userId });
  } finally {
    await db.disconnect();
  }
});
