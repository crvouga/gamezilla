import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema-postgres';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';

import { idpSchema } from '../shared/schema/tables';

export type AuthPostgresDatabaseMigrationOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
};

/** Applies IdP tables to Postgres (declared-only coexist with domain schema). */
export class AuthPostgresDatabaseMigration implements DatabaseMigration {
  private readonly options: AuthPostgresDatabaseMigrationOptions;

  constructor(options?: AuthPostgresDatabaseMigrationOptions) {
    this.options = options ?? {};
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const dbScope = this.options.dbScope ?? createPostgresDbScope('public');
    ctx.logger.info('applying IdP schema (postgres)');
    await new PostgresSchemaDatabaseMigration(idpSchema, dbScope, {
      skipAdvisoryLock: this.options.skipAdvisoryLock ?? true,
      alreadyInTransaction: this.options.alreadyInTransaction ?? false,
    }).migrate(ctx);
    ctx.logger.info('IdP schema applied (postgres)');
  }
}
