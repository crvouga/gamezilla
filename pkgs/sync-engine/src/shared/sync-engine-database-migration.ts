import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { applyFrameworkServerDdl } from './apply-framework-server-ddl';

/** Applies sync-engine framework server DDL (`sync_engine_mutations_applied`, …). */
export class SyncEngineDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await applyFrameworkServerDdl({
      sqlClient: ctx.sqlClient,
      logger: ctx.logger,
    });
  }
}
