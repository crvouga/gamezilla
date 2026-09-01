import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres/schema';

import { KvCutoverMigration } from './cutover-migration';
import {
  applyKvStorageOptimizations,
  pingKvTable,
} from './postgres-storage-knobs';
import { kvSchema } from './schema/tables';

export type KvPostgresDatabaseMigrationOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
};

/** Cutover → defineTable reconcile → UNLOGGED/fillfactor knobs. */
export class KvPostgresDatabaseMigration implements DatabaseMigration {
  private readonly options: KvPostgresDatabaseMigrationOptions;

  constructor(options?: KvPostgresDatabaseMigrationOptions) {
    this.options = options ?? {};
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const dbScope = this.options.dbScope ?? createPostgresDbScope('public');
    const log = ctx.logger.child({ migration: 'kv-postgres' });
    log.info('kv postgres migrate: start');
    await new KvCutoverMigration().migrate(ctx);
    await new PostgresSchemaDatabaseMigration(kvSchema, dbScope, {
      skipAdvisoryLock: this.options.skipAdvisoryLock ?? true,
      alreadyInTransaction: this.options.alreadyInTransaction ?? true,
    }).migrate(ctx);
    await applyKvStorageOptimizations(ctx.sqlClient, log);
    await pingKvTable(ctx.sqlClient);
    log.info('kv postgres migrate: complete');
  }
}
