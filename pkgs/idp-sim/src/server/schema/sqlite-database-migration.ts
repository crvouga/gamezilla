import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { idpSimSchema } from './tables';

/**
 * Applies the simulated IdP's tables to a SQLite database without touching
 * undeclared tables — the same file may hold nothing else today, but the IdP
 * must never drop a neighbour it did not create.
 */
export class IdpSimSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying idp_sim schema (sqlite)');
    await new SqliteSchemaDatabaseMigration(idpSimSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
    ctx.logger.info('idp_sim schema applied (sqlite)');
  }
}
