import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from './database-migration';

/**
 * Runs registered {@link DatabaseMigration}s sequentially in registration order.
 */
export class ComposedDatabaseMigration implements DatabaseMigration {
  private readonly migrations: DatabaseMigration[] = [];

  register(migration: DatabaseMigration): this {
    this.migrations.push(migration);
    return this;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    for (const migration of this.migrations) {
      await migration.migrate(ctx);
    }
  }
}
