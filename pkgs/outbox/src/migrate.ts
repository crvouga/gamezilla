import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema-postgres';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';

import { OutboxCutoverMigration } from './cutover-migration';
import { outboxSchema } from './schema/tables';

/** Apply outbox defineTable schema to SQLite (client / harness). */
export async function migrateOutbox(sqlClient: SqlClient): Promise<void> {
  await applySqliteSchema(sqlClient, outboxSchema, {
    ownership: 'declared-only',
  });
}

export type OutboxDatabaseMigrationOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  /** When true, skip Postgres cutover (SQLite / fresh-only paths). */
  readonly dialect?: 'postgres' | 'sqlite';
};

/**
 * Postgres: cutover then reconcile. SQLite callers should use
 * {@link migrateOutbox} or pass `dialect: 'sqlite'`.
 */
export class OutboxDatabaseMigration implements DatabaseMigration {
  private readonly options: OutboxDatabaseMigrationOptions;

  constructor(options?: OutboxDatabaseMigrationOptions) {
    this.options = options ?? {};
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    if (this.options.dialect === 'sqlite') {
      await migrateOutbox(ctx.sqlClient);
      return;
    }
    const dbScope = this.options.dbScope ?? createPostgresDbScope('public');
    ctx.logger.info('applying outbox schema (postgres)');
    await new OutboxCutoverMigration().migrate(ctx);
    await new PostgresSchemaDatabaseMigration(outboxSchema, dbScope, {
      skipAdvisoryLock: this.options.skipAdvisoryLock ?? true,
      alreadyInTransaction: this.options.alreadyInTransaction ?? true,
    }).migrate(ctx);
    ctx.logger.info('outbox schema applied (postgres)');
  }
}
