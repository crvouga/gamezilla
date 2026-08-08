import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import type { Schema } from '../core/types';
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
    ctx.logger.info('domain schema reconciled');
  }
}
