import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { OUTBOX_DDL_STATEMENTS } from './schema';

export async function migrateOutbox(sqlClient: SqlClient): Promise<void> {
  for (const statement of OUTBOX_DDL_STATEMENTS) {
    await sqlClient.run(unsafe(statement));
  }
}

export class OutboxDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await migrateOutbox(ctx.sqlClient);
  }
}
