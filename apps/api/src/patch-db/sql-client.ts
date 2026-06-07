import { openPgClient } from '@pkgs/sql-client/postgres-connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Client } from '@pkgs/sql-client/pg-types';

export type RequestDb = {
  readonly client: Client;
  readonly sqlClient: SqlClient;
};

/**
 * One `pg.Client` per Worker request (Cloudflare Hyperdrive + no global pool),
 * with its session `search_path` pinned to the application schema.
 */
export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  return openPgClient({ connectionString, dbScope });
}
