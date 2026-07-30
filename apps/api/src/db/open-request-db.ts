import {
  adaptPgClientAsPool,
  openPgClient,
} from '@pkgs/sql-client/postgres/connect';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

export type RequestDb = {
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
};

/**
 * One pinned Postgres session per Worker request, shared by sync upload routes
 * and auth provisioning via {@link adaptPgClientAsPool} (one TCP session, no pool
 * deadlocks).
 *
 * Do not share sockets across requests in the Workers runtime — a module-scoped
 * `pg.Pool` hangs concurrent handlers (wrangler cancels with "Worker's code had
 * hung and would never generate a response").
 */
export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  const { client, sqlClient } = await openPgClient({
    connectionString,
    dbScope,
  });
  const pool = adaptPgClientAsPool(client, dbScope, connectionString);
  return { sqlClient, pool };
}
