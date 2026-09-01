import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { SyncEngineDatabaseMigration } from './sync-engine-database-migration';

/** Apply sync-engine framework server tables via defineTable reconcile. */
export async function applyFrameworkServerDdl(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  await new SyncEngineDatabaseMigration().migrate({
    sqlClient: args.sqlClient,
    logger: args.logger,
  });
}
