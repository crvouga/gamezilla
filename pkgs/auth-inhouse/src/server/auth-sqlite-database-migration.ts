import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { idpSchema } from '../shared/schema/tables';

/** Applies IdP tables to SQLite without dropping undeclared framework tables. */
export class AuthSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying IdP schema (sqlite)');
    await new SqliteSchemaDatabaseMigration(idpSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
    ctx.logger.info('IdP schema applied (sqlite)');
  }
}
