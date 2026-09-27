import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema-sqlite';

import { billingMockSchema } from './tables';

/**
 * Applies the provider's tables without touching undeclared ones: the file
 * may be shared, and the provider must never drop a neighbour it did not
 * create.
 */
export class BillingMockSqliteDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await new SqliteSchemaDatabaseMigration(billingMockSchema, {
      ownership: 'declared-only',
    }).migrate(ctx);
  }
}
