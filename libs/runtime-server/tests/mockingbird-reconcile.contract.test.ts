import { expect, test } from 'bun:test';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { reconcilePostgres } from '@libs/runtime-server/reconcile-postgres';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import { raw } from '@pkgs/sql-root-shared/sql';

// Exercise the same full reconciliation used by the local stack: no skipped phases or SQL shims.
// regression: mockingbird-postgres-index-validity
// regression: mockingbird-postgres-regnamespace-equality
test('the application schema reconciles twice over the Mockingbird wire server', async () => {
  const failures: { sql: string; status: string }[] = [];
  const server = await startMockingbirdPostgres({
    port: 0,
    store: new ObjectStoreImplInMemory(),
    onLog: (entry) => {
      if (entry.status !== 'ok')
        failures.push({ sql: entry.sql, status: entry.status });
    },
  });
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: server.url,
    dbScope,
    max: 1,
  });
  try {
    const args = {
      sqlClient,
      dbScope,
      logger: createNoopLogger(),
      clock: { now: () => 1_717_200_000_000 },
    };
    await reconcilePostgres(args);
    await reconcilePostgres(args);
    expect(
      await sqlClient.query(
        raw<{ schema: string }>(`SELECT current_schema() AS schema`)
      )
    ).toEqual([{ schema: 'public' }]);
  } catch (error) {
    throw new Error(JSON.stringify(failures), { cause: error });
  } finally {
    await pool.end();
    await server.stop();
  }
});
