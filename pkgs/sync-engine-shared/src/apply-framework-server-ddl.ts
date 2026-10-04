import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import { reconcileSyncEnginePostgres } from './reconcile-sync-engine-postgres';

/** Bring sync-engine framework server tables in line with their declared schema. */
export async function applyFrameworkServerDdl(args: {
  sqlClient: SqlClient;
}): Promise<void> {
  await reconcileSyncEnginePostgres(args.sqlClient);
}
