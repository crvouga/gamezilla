import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { ensurePostgresSchema } from './connect';
import type { PostgresDbScope } from './schema';

/** Ensures the application Postgres schema exists before other migrates. */
export class EnsurePostgresSchemaMigration implements DatabaseMigration {
  constructor(private readonly dbScope: PostgresDbScope) {}

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await ensurePostgresSchema(ctx.sqlClient, this.dbScope);
  }
}
