import { SqlClientImplPgClient } from '@pkgs/sql-client/impl-pg';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Client } from 'pg';

export type RequestDb = {
  readonly client: Client;
  readonly sqlClient: SqlClient;
};

/**
 * One `pg.Client` per Worker request (Cloudflare Hyperdrive + no global pool).
 */
export async function openRequestDb(
  connectionString: string
): Promise<RequestDb> {
  const client = new Client({ connectionString });
  await client.connect();
  return { client, sqlClient: new SqlClientImplPgClient(client) };
}
