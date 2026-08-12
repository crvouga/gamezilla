/**
 * Postgres adapter for `@pkgs/matchmaking`.
 *
 * Import via `@pkgs/matchmaking/impl-sql`. Composition roots construct
 * {@link MatchmakingImplSql}; contract tests never import this module
 * directly except via an adapter factory.
 */

export {
  MatchmakingImplSql,
  type MatchmakingImplSqlOptions,
} from './matchmaking';
export {
  MatchmakingDatabaseMigration,
  type MatchmakingDatabaseMigrationArgs,
} from './matchmaking-database-migration';
