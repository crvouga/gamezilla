import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { entityStoreSchema } from './schema/tables';

/** Applies `entity_store` to SQLite without dropping undeclared tables. */
export class EntityStoreSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying entity_store schema (sqlite)');
    await new SqliteSchemaDatabaseMigration(entityStoreSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
    ctx.logger.info('entity_store schema applied (sqlite)');
  }
}
