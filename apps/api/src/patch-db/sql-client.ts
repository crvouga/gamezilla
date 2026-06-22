import { openPgClient } from '@pkgs/sql-client/postgres-connect';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';

export type RequestDb = {
  readonly sqlClient: PostgresSqlClient;
};

/**
 * One Postgres session per Worker request, with its session `search_path`
 * pinned to the application schema via TCP `pg`.
 */
export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  const { sqlClient } = await openPgClient({ connectionString, dbScope });
  return { sqlClient };
}
