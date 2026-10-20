import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import {
  createPgPool,
  openPgClient,
} from '@pkgs/sql-client-postgres-server/connect';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client-postgres-server/impl-bun-postgres';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres-shared/ensure-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';

export const CONCURRENT_DRIVERS = ['pool', 'session', 'bun'] as const;
export type ConcurrentDriver = (typeof CONCURRENT_DRIVERS)[number];

function perRequestSessions(
  admin: SqlClient,
  url: string,
  dbScope: PostgresDbScope
): SqlClient {
  return {
    connect: () => admin.connect(),
    disconnect: () => Promise.resolve(),
    query: (q) => admin.query(q),
    run: (q) => admin.run(q),
    prepare: (q) => admin.prepare(q),
    transaction: async (body) => {
      const session = await openPgClient({ connectionString: url, dbScope });
      try {
        return await session.sqlClient.transaction(body);
      } finally {
        await session.client.end();
      }
    },
  };
}

export async function openConcurrentPostgres(driver: ConcurrentDriver) {
  const pg = await startMockingbirdPostgres({
    port: 0,
    store: new ObjectStoreImplInMemory(),
  });
  const dbScope = createPostgresDbScope('concurrent_rating');
  const { pool, sqlClient: admin } = createPgPool({
    connectionString: pg.url,
    dbScope,
    max: 4,
  });
  const db =
    driver === 'pool'
      ? admin
      : driver === 'session'
        ? perRequestSessions(admin, pg.url, dbScope)
        : SqlClientImplBunPostgres.connect(pg.url, dbScope);
  const dispose = async () => {
    try {
      if (driver === 'bun') await db.disconnect();
      await pool.end();
    } finally {
      await pg.stop();
    }
  };
  try {
    await ensurePostgresSchema(admin, dbScope);
    await db.connect();
    return {
      db,
      admin,
      dbScope,
      async [Symbol.asyncDispose]() {
        await dispose();
      },
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
