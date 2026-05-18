/**
 * Public surface of `@gamezilla/matchmaking`. This file IS the contract.
 *
 * Three subpath imports exist and three are intended for consumers:
 *
 *   - `@gamezilla/matchmaking` (this file) — the `Matchmaking` class,
 *     the HTTP client, the public types. Everything 99% of embedders
 *     need.
 *   - `@gamezilla/matchmaking/storage` — `SqlClient` plus the two
 *     adapters (`createPgSqlClient`, `createPgliteSqlClient`) for
 *     embedders that need to thread their own per-request `pg.Client`
 *     instead of relying on `Matchmaking.fromPool`.
 *   - `@gamezilla/matchmaking/wire` — `FormulaWire` types for HTTP /
 *     RPC consumers that need to validate JSON without `AttributeTag`s.
 *
 * The package `exports` map in `package.json` enforces this at the
 * Node resolution layer; the root `tsconfig.json` mirrors it for the
 * TypeScript layer. Anything outside these three subpaths is INTERNAL
 * and may change without notice.
 *
 * Typical embedder usage:
 *
 *   import { Matchmaking, createAttrNamespace } from '@gamezilla/matchmaking';
 *
 *   const ns = createAttrNamespace('chess');
 *   const rating = ns('rating', (v) => (typeof v === 'number' ? v : 0));
 *
 *   const mm = Matchmaking.fromPool(pool, {
 *     schema: { partitionKeys: ['chess/mode'], bucketWidth: 50 },
 *   });
 *   await mm.ready();
 *
 *   const { participantId } = await mm.join({
 *     data: rating(1500),
 *     formulas: [{ numeric: [{ tag: rating, weight: 1 }] }],
 *   });
 *
 *   hono.route('/matchmaking', mm.app({ requireAuth }));
 *
 * Six public instance methods on the class: `ready`, `join`, `leave`,
 * `status`, `app`, `tick`, plus the static `fromPool` factory.
 * Everything else is internal.
 */

export { MatchmakingClient } from './client';
export type { MatchmakingClientOptions, WaitForMatchOptions } from './client';
export { MatchmakingHttpError } from './client-error';
export {
  MATCHMAKING_PAYLOAD_LIMITS,
  MatchmakingSchemaDriftError,
  Matchmaking,
  type MatchmakingAppOptions,
  type MatchmakingOptions,
  type MatchmakingStorage,
  type MatchmakingTuning,
  type TickOptions,
  type TickResult,
} from './matchmaking';
export type { MatchmakingSchema } from './migrate';
export {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type DistanceFormulaCategoricalTerm,
  type DistanceFormulaNumericTerm,
  type DistanceFormulaPartitionTerm,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchedParticipant,
  type MatchedStatus,
  type ParticipantStatus,
  type RadiusOptions,
  type StatusResult,
  type UpdateFormulasResult,
  type WaitingStatus,
} from './types';

/**
 * Re-exported from `@gamezilla/lib/attribute` for the common case of
 * building an attribute namespace alongside a `Matchmaking` boot.
 * Consumers who need more attribute helpers should depend on
 * `@gamezilla/lib` directly — this single function is the only one
 * intentionally surfaced through the matchmaking barrel.
 */
export { createAttrNamespace } from '@gamezilla/lib/attribute';
