import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import type { Schema } from '../core/types';
import { type SqliteOwnership, sqlite } from './driver';

export type SqliteSchemaDatabaseMigrationOptions = {
  /**
   * `declared-only` (default): leave undeclared tables alone (coexist with framework tables).
   * `whole-db`: drop undeclared tables — the bound DB is wholly owned.
   */
  readonly ownership?: SqliteOwnership;
};

/**
 * Applies a {@link Schema} to SQLite. Use `ownership: 'declared-only'` when the
 * same file also holds sync-engine framework tables.
 */
export class SqliteSchemaDatabaseMigration implements DatabaseMigration {
  private readonly schema: Schema;
  private readonly options: SqliteSchemaDatabaseMigrationOptions | undefined;

  constructor(schema: Schema, options?: SqliteSchemaDatabaseMigrationOptions) {
    this.schema = schema;
    this.options = options;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await sqlite(this.schema, ctx.sqlClient, this.options).reconcile();
  }
}
