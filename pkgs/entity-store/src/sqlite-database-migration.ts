import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { raw } from '@pkgs/sql';

import {
  ENTITY_STORE_CREATE_INDEX_DDL,
  ENTITY_STORE_CREATE_TABLE_DDL,
  ENTITY_STORE_TABLE,
} from './schema-ddl';

/** Idempotent portable DDL for the `entity_store` table (SQLite / sim). */
export class EntityStoreSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const log = ctx.logger.child({ migration: 'entity-store-sqlite' });
    log.info('entity_store sqlite migrate: applying ddl', {
      table: ENTITY_STORE_TABLE,
    });
    await ctx.sqlClient.run(raw(ENTITY_STORE_CREATE_TABLE_DDL));
    for (const stmt of ENTITY_STORE_CREATE_INDEX_DDL) {
      await ctx.sqlClient.run(raw(stmt));
    }
    log.info('entity_store sqlite migrate: complete', {
      table: ENTITY_STORE_TABLE,
    });
  }
}
