import { openNeonRequestSession } from '@pkgs/sql-client/neon-connect';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';

export type RequestDb = {
  readonly sqlClient: PostgresSqlClient;
};

/**
 * One Neon HTTP session per Worker request, with its session `search_path`
 * pinned to the application schema.
 */
export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  return openNeonRequestSession({ connectionString, dbScope });
}
