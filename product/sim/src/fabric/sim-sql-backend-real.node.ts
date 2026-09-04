/**
 * Node / bun real fabric entry.
 * Imports `.impl` directly so Expo never re-resolves through `.native.ts`.
 */
export {
  openRealClientSql,
  openRealServerSql,
  openRealServerSqlFromSeed,
  REAL_CHECKPOINT_SQL_FORMAT,
} from './sim-sql-backend-real.impl';
