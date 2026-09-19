import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import type { Schema } from '@pkgs/db-schema/core/types';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { postgres } from './driver';

export type PostgresSchemaIndexReconcileMigrationOptions = {
  /**
   * Skip the package session advisory lock when the caller already holds one.
   */
  readonly skipAdvisoryLock?: boolean;
};

/**
 * Owns index DDL for a {@link Schema}. Runs after the advisory-locked schema
 * transaction so every build is `CREATE INDEX CONCURRENTLY` and never holds
 * the migrate transaction's locks. A failed concurrent build leaves an invalid
 * index behind; this phase drops it before rebuilding.
 */
export class PostgresSchemaIndexReconcileMigration
  implements DatabaseMigration
{
  private readonly schema: Schema;
  private readonly dbScope: PostgresDbScope;
  private readonly options:
    | PostgresSchemaIndexReconcileMigrationOptions
    | undefined;

  constructor(
    schema: Schema,
    dbScope: PostgresDbScope,
    options?: PostgresSchemaIndexReconcileMigrationOptions
  ) {
    this.schema = schema;
    this.dbScope = dbScope;
    this.options = options;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const client = Object.assign(ctx.sqlClient, {
      dbScope: this.dbScope,
    }) as PostgresSqlClient;
    await postgres(this.schema, client, {
      skipAdvisoryLock: this.options?.skipAdvisoryLock ?? false,
      alreadyInTransaction: false,
      indexPhase: 'only',
    }).reconcile();
    ctx.logger.info('domain schema indexes reconciled');
  }
}
