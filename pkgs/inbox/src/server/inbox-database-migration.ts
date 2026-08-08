import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { migrateInbox } from './migrate';

/** Applies inbox SQL schema (interactions, preferences, schema fingerprint). */
export class InboxDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await migrateInbox(ctx.sqlClient);
  }
}
