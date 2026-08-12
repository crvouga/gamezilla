import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { raw } from '@pkgs/sql';

import { KV_CREATE_TABLE_DDL, KV_TABLE } from './schema-ddl';

/** Idempotent portable DDL for the `kv` table (SQLite / sim). */
export class KvSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const log = ctx.logger.child({ migration: 'kv-sqlite' });
    log.info('kv sqlite migrate: applying ddl', { table: KV_TABLE });
    await ctx.sqlClient.run(raw(KV_CREATE_TABLE_DDL));
    log.info('kv sqlite migrate: complete', { table: KV_TABLE });
  }
}
