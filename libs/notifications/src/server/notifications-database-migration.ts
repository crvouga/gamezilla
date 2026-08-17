import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import { migrateNotifications } from './migrate';

/** Applies inbox SQL schema (interactions, preferences, schema fingerprint). */
export class NotificationsDatabaseMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await migrateNotifications(ctx.sqlClient);
  }
}
