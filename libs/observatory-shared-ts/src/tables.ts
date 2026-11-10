import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

// Durable SQL identifiers remain stable across releases: these tables keep
// the `population_` names they were created with.

/**
 * Everyone's open app, a person's or a Synthetic User's: one row per account
 * and device, kept fresh by the app's heartbeat. Online now is a heartbeat
 * within the online window; closing the app soft-deletes the row. While it is
 * watched live, `frame` holds the latest sanitized picture of its screen.
 * Never synced: only the User Observatory reads it, through its own routes.
 */
export const observatoryLiveSessions = defineTable({
  domain: 'population',
  name: 'population_live_sessions',
  columns: {
    account_id: 'text',
    device_id: 'text',
    place: 'text',
    activity: 'text',
    game: 'text',
    heartbeat_at: 'timestamp',
    frame: 'text',
    frame_at: 'timestamp',
  },
  uniqueIndexes: [['account_id', 'device_id']],
  indexes: ['heartbeat_at'],
});
/**
 * That someone is watching an app live, synced only to that account's own
 * devices so the watched app knows to send its screen. It holds no picture.
 */
export const observatoryLiveWatches = defineTable({
  domain: 'population',
  name: 'population_live_watches',
  columns: {
    account_id: 'text',
    device_id: 'text',
    watched_until: 'timestamp',
  },
  uniqueIndexes: [['account_id', 'device_id']],
});
export const OBSERVATORY_TABLES = [
  observatoryLiveSessions,
  observatoryLiveWatches,
] as const;
