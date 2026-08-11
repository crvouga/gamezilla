/**
 * In-process pg-mem Postgres for product simulations.
 *
 * One shared pg-mem database + pool for the simulation lifetime. Request
 * middleware still calls `disconnect` / `pool.end`; those are no-ops here so
 * schema/data survive across requests. Minting a fresh `createPg()` adapter
 * per request deadlocks under Jest when requests overlap.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { createPgMemSqlClient } from '@pkgs/sql-client/postgres/impl-pg-mem';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';

/** Placeholder URL for secret-store / config (pg-mem has no TCP listener). */
export const PG_MEM_DATABASE_URL = 'postgresql://pg-mem/sim';

export type PgMemHandle = {
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
  readonly openRequestDb: OpenRequestDb;
  stop(): Promise<void>;
};

function sharedRequestSqlClient(
  sqlClient: PostgresSqlClient
): PostgresSqlClient {
  return {
    get dbScope() {
      return sqlClient.dbScope;
    },
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      sqlClient.transaction(fn),
  };
}

function sharedRequestPool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === 'end') {
        return async () => undefined;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

/** Boots a fresh in-memory Postgres ready for migrate + in-process API. */
export async function bootPgMem(): Promise<PgMemHandle> {
  const dbScope = appPostgresDbScope();
  const { sqlClient, pool } = createPgMemSqlClient({ dbScope });
  await sqlClient.connect();

  const openRequestDb: OpenRequestDb = async () => ({
    sqlClient: sharedRequestSqlClient(sqlClient),
    pool: sharedRequestPool(pool),
  });

  return {
    sqlClient,
    pool,
    openRequestDb,
    async stop() {
      await sqlClient.disconnect();
    },
  };
}
