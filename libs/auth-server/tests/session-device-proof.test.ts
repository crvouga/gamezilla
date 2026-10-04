import { expect, test } from 'bun:test';
import { AnonUserService } from '@libs/auth-shared/anon-user-service';
import { SessionAuth } from '@libs/auth-shared/session-middleware';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

test('an install header cannot authenticate its signed-in owner', async () => {
  // regression: install-header-impersonated-account
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(AUTH_TABLES));
    const ports = createHarnessAdapters({ seed: 1 });
    const users = new AnonUserService(db, ports);
    const device = '11111111-1111-4111-8111-111111111111';
    const user = await users.ensureForDevice({ deviceId: device });
    await users.clearUserAnonFlag(user.userId, ports.clock.now);
    const auth = new SessionAuth(
      {
        provider: 'idp',
        verifySessionToken: async () => null,
        getUser: async () => null,
        deleteUser: async () => {},
      },
      ports
    );
    expect(
      await auth.resolveAuthContext(
        db,
        new Request('http://test/api/query', {
          headers: { 'x-anon-id': device },
        })
      )
    ).toEqual({});
  } finally {
    await db.disconnect();
  }
});
