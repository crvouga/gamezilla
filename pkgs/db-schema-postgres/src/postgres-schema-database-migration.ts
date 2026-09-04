import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import type { Schema } from '@pkgs/db-schema/core/types';
import { unsafe } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { postgres } from './driver';

export type PostgresSchemaDatabaseMigrationOptions = {
  /**
   * Skip the package session advisory lock when the caller already holds a
   * migrate mutex (e.g. `pg_advisory_xact_lock` in api migrate).
   */
  readonly skipAdvisoryLock?: boolean;
  /**
   * When true, run table DDL on the injected client without opening a nested
   * transaction (caller already provides a transaction).
   */
  readonly alreadyInTransaction?: boolean;
};

/**
 * Applies a {@link Schema} to Postgres (create table / add column /
 * package-prefixed indexes). Inject `skipAdvisoryLock` + `alreadyInTransaction`
 * when nested under a migrate advisory-locked transaction.
 */
export class PostgresSchemaDatabaseMigration implements DatabaseMigration {
  private readonly schema: Schema;
  private readonly dbScope: PostgresDbScope;
  private readonly options: PostgresSchemaDatabaseMigrationOptions | undefined;

  constructor(
    schema: Schema,
    dbScope: PostgresDbScope,
    options?: PostgresSchemaDatabaseMigrationOptions
  ) {
    this.schema = schema;
    this.dbScope = dbScope;
    this.options = options;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const client = Object.assign(ctx.sqlClient, {
      dbScope: this.dbScope,
    }) as PostgresSqlClient;
    await postgres(this.schema, client, this.options).reconcile();
    // Existing tables may still have engine DEFAULT now()/gen_random_uuid().
    await ctx.sqlClient.run(
      unsafe(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.column_name IN ('id', 'created_at', 'updated_at')
      AND c.column_default IS NOT NULL
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT',
      r.table_name,
      r.column_name
    );
  END LOOP;
END $$;
`)
    );
    ctx.logger.info('domain schema reconciled');
  }
}
