import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { EntityStoreImplPostgres } from './impl-postgres';

/** Idempotent Postgres DDL for the `entity_store` table. */
export class EntityStorePostgresDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await EntityStoreImplPostgres.migrateUp({
      sqlClient: ctx.sqlClient,
      logger: ctx.logger,
    });
  }
}
