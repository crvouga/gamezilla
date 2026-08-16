// @api-wall-ok — injected Postgres OpenRequestDb adapter (Worker composition).
/**
 * Opens Postgres for one Worker request.
 *
 * - **Loopback (`@apps/postgres`)**: shared `pg.Pool` on `globalThis` so Wrangler
 *   HMR cannot orphan one TCP client per reload (max_connections exhaustion).
 *   Checkout is released in middleware `disconnect` — the pool itself stays warm.
 * - **Remote (Neon / prd)**: one pinned `pg.Client` per request (Workers must not
 *   share sockets across requests).
 */

import {
  adaptPgClientAsPool,
  createPgPool,
  isLoopbackPostgresUrl,
  openPgClient,
} from '@pkgs/sql-client/postgres/connect';
import { SqlClientImplPgClient } from '@pkgs/sql-client/postgres/impl-pg-client';
import type {
  Client,
  Pool,
  PoolClient,
} from '@pkgs/sql-client/postgres/pg-types';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { postgresRejectsStartupSearchPathOption } from '@pkgs/sql-client/postgres/session-schema';

import type { RequestDb } from './open-request-db';

const DEV_POOL_MAX = 20;

type DevPoolSlot = {
  readonly connectionString: string;
  readonly pool: Pool;
};

type GlobalDevPg = {
  __gamezillaDevPgPool?: DevPoolSlot;
};

function sharedLoopbackPool(
  connectionString: string,
  dbScope: PostgresDbScope
): Pool {
  const g = globalThis as GlobalDevPg;
  const existing = g.__gamezillaDevPgPool;
  if (
    existing !== undefined &&
    existing.connectionString === connectionString
  ) {
    return existing.pool;
  }
  if (existing !== undefined) {
    void existing.pool.end().catch(() => undefined);
  }
  const { pool } = createPgPool({
    connectionString,
    dbScope,
    max: DEV_POOL_MAX,
  });
  g.__gamezillaDevPgPool = { connectionString, pool };
  return pool;
}

/** Middleware calls `pool.end()` after every request — must be a no-op for the shared pool. */
function sharedPoolRequestFacade(): Pool {
  return {
    end: async () => undefined,
    connect: async () => {
      throw new Error('sharedPoolRequestFacade.connect is not used');
    },
    query: async () => {
      throw new Error('sharedPoolRequestFacade.query is not used');
    },
    on: () => sharedPoolRequestFacade(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as Pool;
}

async function openLoopbackRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  const pool = sharedLoopbackPool(connectionString, dbScope);
  const client = (await pool.connect()) as PoolClient;
  const pinSearchPathEachQuery =
    postgresRejectsStartupSearchPathOption(connectionString);
  const inner = new SqlClientImplPgClient(
    client as unknown as Client,
    dbScope,
    pinSearchPathEachQuery
  );
  await inner.connect();
  return {
    kind: 'postgres',
    sqlClient: {
      dbScope,
      connect: () => Promise.resolve(),
      disconnect: async () => {
        client.release();
      },
      query: (query) => inner.query(query),
      run: (query) => inner.run(query),
      prepare: (query) => inner.prepare(query),
      transaction: (fn) => inner.transaction(fn),
    },
    pool: sharedPoolRequestFacade(),
  };
}

export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  if (isLoopbackPostgresUrl(connectionString)) {
    return openLoopbackRequestDb(connectionString, dbScope);
  }
  const { client, sqlClient } = await openPgClient({
    connectionString,
    dbScope,
  });
  const pool = adaptPgClientAsPool(client, dbScope, connectionString);
  return { kind: 'postgres', sqlClient, pool };
}
