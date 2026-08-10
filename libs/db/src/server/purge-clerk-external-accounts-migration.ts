import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { sql } from '@pkgs/sql';

/** Hard-cutover data migration: drop legacy Clerk rows from `auth_external_accounts`. */
export class PurgeClerkExternalAccountsMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await ctx.sqlClient.run(sql<void>`
      DELETE FROM auth_external_accounts
      WHERE provider = 'clerk'
    `);
    ctx.logger.info('purged clerk auth_external_accounts rows (hard cutover)');
  }
}
