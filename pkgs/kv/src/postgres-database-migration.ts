import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { KvImplPostgres } from './impl-postgres';

/** Idempotent Postgres DDL for the `kv` table. */
export class KvPostgresDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await KvImplPostgres.migrateUp({
      sqlClient: ctx.sqlClient,
      logger: ctx.logger,
    });
  }
}
