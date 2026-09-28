import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { idpMockSchema } from './tables';

/**
 * Applies the simulated IdP's tables to a SQLite database without touching
 * undeclared tables — the same file may hold nothing else today, but the IdP
 * must never drop a neighbour it did not create.
 */
export class IdpMockSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying idp_mock schema (sqlite)');
    await new SqliteSchemaDatabaseMigration(idpMockSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
    ctx.logger.info('idp_mock schema applied (sqlite)');
  }
}
