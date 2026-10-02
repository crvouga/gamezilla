import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  freePostgresPort,
  startEmbeddedPostgres,
} from '@pkgs/postgres-embedded';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';
import {
  createPgPool,
  ensurePostgresSchema,
  openPgClient,
} from '@pkgs/sql-client-postgres/connect';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client-postgres/impl-bun-postgres';

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
  const dataDir = mkdtempSync(join(tmpdir(), 'chess-concurrent-'));
  const pg = await startEmbeddedPostgres({
    port: await freePostgresPort(),
    dataDir,
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
      try {
        await pg.stop();
      } finally {
        rmSync(dataDir, { recursive: true, force: true });
      }
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
