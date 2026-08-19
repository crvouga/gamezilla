/**
 * Installs SQLite-shaped JSON1 helpers on Postgres so application SQL can
 * target one dialect on both engines.
 */

import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';

export class PostgresSqliteCompatMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await installPostgresSqliteCompat({ sqlClient: ctx.sqlClient });
  }
}
