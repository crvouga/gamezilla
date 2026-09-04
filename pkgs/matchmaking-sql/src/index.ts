/**
 * SQL adapter for `@pkgs/matchmaking` (SQLite + Postgres via portable SQL).
 *
 * Import via `@pkgs/matchmaking-sql`.
 */

export {
  MatchmakingImplSql,
  type MatchmakingImplSqlOptions,
} from './matchmaking';
export {
  MatchmakingDatabaseMigration,
  type MatchmakingDatabaseMigrationArgs,
} from './matchmaking-database-migration';
