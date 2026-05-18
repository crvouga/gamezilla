/**
 * Public surface of `@gamezilla/matchmaking`.
 *
 * Typical embedder usage:
 *
 *   import { Matchmaking, createAttrNamespace } from '@gamezilla/matchmaking';
 *
 *   const ns = createAttrNamespace('chess');
 *   const rating = ns('rating', (v) => typeof v === 'number' ? v : 0);
 *
 *   const mm = new Matchmaking({
 *     storage: { pool },
 *     schema: { partitionKeys: ['chess/mode'], bucketWidth: 50 },
 *   });
 *
 *   const { participantId } = await mm.join({
 *     data: rating(1500),
 *     formulas: [{ numeric: [{ tag: rating, weight: 1 }] }],
 *   });
 *   const status = await mm.status(participantId);
 *
 *   hono.route('/matchmaking', mm.app({ requireAuth }));
 *
 * That six-method surface (`join`, `leave`, `status`, `app`, `ready`,
 * `tick`) is the entire public API. Subpath imports cover the two rare
 * cases:
 *
 *   - `@gamezilla/matchmaking/storage` — `SqlClient` adapters and types
 *     (when you need to thread your own per-request `pg.Client` instead
 *     of giving the library a `pg.Pool`).
 *   - `@gamezilla/matchmaking/wire` — `FormulaWire` shapes for HTTP /
 *     RPC consumers that need to validate JSON without `AttributeTag`s.
 */

export { MatchmakingClient } from './client';
export type { MatchmakingClientOptions, WaitForMatchOptions } from './client';
export { MatchmakingHttpError } from './client-error';
export {
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
