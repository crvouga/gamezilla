import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

/**
 * Hard-cutover: drop pre-prefix domain, sync-engine, and legacy auth tables.
 * Idempotent; no data copy. Registered before framework/domain/IdP migrate.
 */
export const LEGACY_TABLES_TO_DROP = [
  // Domain (pre-prefix)
  'users',
  'devices',
  'external_accounts',
  'profiles',
  'space_users',
  'space_open_sessions',
  'friend_requests',
  'friendships',
  'user_blocks',
  // Sync engine (pre-prefix)
  '_mutations',
  '_mutations_applied',
  'write_rejections',
  '_scope_meta',
  '_push_applied',
  '_sync_topic_seq',
  '_sync_topic_checkpoint',
  '_row_scopes',
  '_upload_state',
  '_peer_applied',
  '_peer_mutations',
  '_topic_applied',
  // legacy auth defaults
  'user',
  'session',
  'account',
  'verification',
  // Pre-notifications rename + abandoned fingerprint helper
  'inbox_interactions',
  'inbox_preferences',
  'inbox_schema_state',
  'notifications_schema_state',
] as const;

export class HardCutoverDropLegacyTablesMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    for (const name of LEGACY_TABLES_TO_DROP) {
      await ctx.sqlClient.run(
        unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)} CASCADE`)
      );
    }
    ctx.logger.info('dropped legacy unprefixed tables (hard cutover)', {
      count: LEGACY_TABLES_TO_DROP.length,
    });
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid table name for DROP: ${name}`);
  }
  return `"${name}"`;
}
