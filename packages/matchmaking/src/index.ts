/**
 * Public surface of `@gamezilla/matchmaking`.
 *
 * Apps embedding the library typically import:
 *   - `migrate` to create the `matchmaking_queue` table on boot
 *   - `Matchmaker` + `createMatchmakingApp` on the server
 *   - `MatchmakingClient` on the client
 *
 * The `SqlClient` port and its adapters are exported so apps can plug in any
 * Postgres-compatible backend (the bundled adapters cover `pg.Pool` and
 * PGlite).
 */

export { createMatchmakingApp, type CreateMatchmakingAppOptions } from './app';
export { MatchmakingClient } from './client';
export type {
  MatchedStatus,
  MatchmakingClientOptions,
  WaitForMatchOptions,
} from './client';
export { MatchmakingHttpError } from './client-error';
export { Matchmaker, type MatchmakerOptions } from './matchmaker';
export { migrate, type MigrateArgs } from './migrate';
export { createPgSqlClient } from './pg-adapter';
export { createPgliteSqlClient } from './pglite-adapter';
export type { QueryResult, SqlClient } from './sql-client';
export {
  DEFAULT_MATCH_SIZE,
  DEFAULT_RADIUS_OPTIONS,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchPassResult,
  type MatchedPlayer,
  type OnMatch,
  type PlayerStatus,
  type RadiusOptions,
  type StatusResult,
} from './types';
