import { ensurePostgresSchema } from '@pkgs/sql-client/postgres/ensure-schema';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from './database-migration';

/** Ensures the application Postgres schema exists before other migrates. */
export class EnsurePostgresSchemaMigration implements DatabaseMigration {
  constructor(private readonly dbScope: PostgresDbScope) {}

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await ensurePostgresSchema(ctx.sqlClient, this.dbScope);
  }
}
