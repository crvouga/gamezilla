/**
 * Re-export sim migrate from `@apps/api` so DST scripts keep a stable local path.
 * Fingerprint bump: outbox + notifications hard cutover (drop inbox_*).
 */

export {
  migrateSimSqlite,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_SQLITE_DATABASE_URL,
} from '@apps/api/system/migrate-sim-sqlite';
