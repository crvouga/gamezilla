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
 * PGlite). The attribute helpers from `@gamezilla/lib` are re-exported so a
 * single `from '@gamezilla/matchmaking'` import covers the whole surface
 * apps need to declare their own match attributes.
 */

export { createMatchmakingApp, type CreateMatchmakingAppOptions } from './app';
export { MatchmakingClient } from './client';
export type { MatchmakingClientOptions, WaitForMatchOptions } from './client';
export { MatchmakingHttpError } from './client-error';
export {
  Matchmaker,
  type CategoricalTermWire,
  type FormulaWire,
  type JoinInputRaw,
  type MatchmakerOptions,
  type NumericTermWire,
  type PartitionTermWire,
} from './matchmaker';
export { migrate, type MigrateArgs } from './migrate';
export { createPgSqlClient } from './pg-adapter';
export { createPgliteSqlClient } from './pglite-adapter';
export type { QueryResult, SqlClient } from './sql-client';
export {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type DistanceFormulaCategoricalTerm,
  type DistanceFormulaNumericTerm,
  type DistanceFormulaPartitionTerm,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchPassResult,
  type MatchedPlayer,
  type MatchedStatus,
  type PlayerStatus,
  type RadiusOptions,
  type StatusResult,
  type WaitingStatus,
} from './types';

export { createAttrNamespace } from '@gamezilla/lib/attribute';
export type {
  AttributeNamespace,
  AttributeParser,
  AttributeState,
  AttributeTag,
  Keyword,
} from '@gamezilla/lib/attribute';
