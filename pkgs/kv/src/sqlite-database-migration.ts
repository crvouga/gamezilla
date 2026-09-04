import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { kvSchema } from './schema/tables';

/** Applies `kv` to SQLite without dropping undeclared tables. */
export class KvSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying kv schema (sqlite)');
    await new SqliteSchemaDatabaseMigration(kvSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
    ctx.logger.info('kv schema applied (sqlite)');
  }
}
