import { AnonUserService } from '@libs/auth-shared-ts/anon-user-service';
import { EnsureInternalAccountUseCase } from '@libs/auth-shared-ts/ensure-internal-account-use-case';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const AUTH: AuthServerPort = {
  provider: 'idp',
  verifySessionToken: async () => null,
  getUser: async () => null,
  deleteUser: async () => {},
};

export async function provisioningHost(
  failures: readonly unknown[],
  rivalWins = false
) {
  const db = SqlClientImplBunSqlite.open(':memory:');
  const time = createHarnessAdapters({ seed: 1 });
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([...AUTH_TABLES, outboxEvents, outboxDeliveries])
  );
  const { userId } = await new AnonUserService(db, time).ensureForDevice({
    deviceId: 'f362fe7c-d338-4893-b6f9-6654cc3b746d',
  });
  const args = { externalUserId: 'idp-alice', upgradeUserId: userId };
  let attempts = 0;
  const wrapper: SqlClient = {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (q) => db.query(q),
    run: (q) => db.run(q),
    prepare: (q) => db.prepare(q),
    transaction: async (fn) => {
      const attempt = attempts++;
      try {
        return await db.transaction(async (tx) => {
          const value = await fn(tx);
          if (attempt < failures.length) throw failures[attempt];
          return value;
        });
      } catch (error) {
        if (rivalWins && attempt === 0)
          await new EnsureInternalAccountUseCase(db, time, AUTH).execute(args);
        throw error;
      }
    },
  };
  return {
    db,
    userId,
    attempts: () => attempts,
    execute: () =>
      new EnsureInternalAccountUseCase(wrapper, time, AUTH).execute(args),
  };
}
