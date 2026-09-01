import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres/schema';

import { SyncEngineCutoverMigration } from '../cutover-migration';
import { syncEngineServerSchema } from './schema/tables';

export type SyncEngineDatabaseMigrationOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
};

/** Cutover legacy DDL → defineTable reconcile for server framework tables. */
export class SyncEngineDatabaseMigration implements DatabaseMigration {
  private readonly options: SyncEngineDatabaseMigrationOptions;

  constructor(options?: SyncEngineDatabaseMigrationOptions) {
    this.options = options ?? {};
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const dbScope = this.options.dbScope ?? createPostgresDbScope('public');
    ctx.logger.info('applying sync-engine server schema (postgres)');
    await new SyncEngineCutoverMigration().migrate(ctx);
    await new PostgresSchemaDatabaseMigration(syncEngineServerSchema, dbScope, {
      skipAdvisoryLock: this.options.skipAdvisoryLock ?? true,
      alreadyInTransaction: this.options.alreadyInTransaction ?? true,
    }).migrate(ctx);
    ctx.logger.info('sync-engine server schema applied (postgres)');
  }
}
