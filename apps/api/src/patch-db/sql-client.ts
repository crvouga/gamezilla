import { openNeonRequestSession } from '@pkgs/sql-client/neon-connect';
import type { NeonWsClient } from '@pkgs/sql-client/neon-types';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type RequestDb = {
  readonly neonClient: NeonWsClient;
  readonly sqlClient: SqlClient;
};

/**
 * One Neon WebSocket session per Worker request, with its session
 * `search_path` pinned to the application schema.
 */
export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  return openNeonRequestSession({ connectionString, dbScope });
}
