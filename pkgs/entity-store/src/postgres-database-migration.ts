import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres/schema';

import { EntityStoreCutoverMigration } from './cutover-migration';
import { entityStoreSchema } from './schema/tables';

export type EntityStorePostgresDatabaseMigrationOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
};

/** Applies `entity_store` via defineTable reconcile (after type cutover). */
export class EntityStorePostgresDatabaseMigration implements DatabaseMigration {
  private readonly options: EntityStorePostgresDatabaseMigrationOptions;

  constructor(options?: EntityStorePostgresDatabaseMigrationOptions) {
    this.options = options ?? {};
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const dbScope = this.options.dbScope ?? createPostgresDbScope('public');
    ctx.logger.info('applying entity_store schema (postgres)');
    await new EntityStoreCutoverMigration().migrate(ctx);
    await new PostgresSchemaDatabaseMigration(entityStoreSchema, dbScope, {
      skipAdvisoryLock: this.options.skipAdvisoryLock ?? true,
      alreadyInTransaction: this.options.alreadyInTransaction ?? true,
    }).migrate(ctx);
    ctx.logger.info('entity_store schema applied (postgres)');
  }
}
