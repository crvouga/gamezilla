/**
 * SQL adapter for `@pkgs/matchmaking` (SQLite + Postgres via portable SQL).
 *
 * Import via `@pkgs/matchmaking-sql`.
 */

export {
  type FormationPorts,
  formMatches,
  type MatchFormation,
} from './match-pass';
export {
  MatchmakingImplSql,
  type MatchmakingImplSqlOptions,
} from './matchmaking';
export { changeAvailability, changeRestriction } from './owner-repository';
export { matchmakingSchema } from './schema/tables';
export { SearchCommands, type SearchPorts } from './search-commands';
export { readCurrent, readSearch } from './search-read';
