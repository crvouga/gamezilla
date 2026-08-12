/**
 * Public port of `@pkgs/matchmaking`.
 *
 * Import via `@pkgs/matchmaking/interface`. Adapters live at
 * `@pkgs/matchmaking/impl-sql`.
 * Contract tests import only this surface (+ `@pkgs/matchmaking/testing`).
 */

export { createAttrNamespace } from '@pkgs/attribute';
export { type CreateMatchmakingAppOptions, createMatchmakingApp } from './app';
export { MatchmakingSchemaDriftError } from './errors';
export type {
  CategoricalTermWire,
  FormulaWire,
  NumericTermWire,
  PartitionTermWire,
  RadiusOptionsWire,
} from './formula-wire';
export {
  assertDataMatchesFormula,
  assertFormula,
  assertWireFormula,
  serializeFormula,
} from './formula-wire';
export type {
  JoinInputRaw,
  Matchmaking,
  MatchmakingAppOptions,
  MatchmakingConfig,
  MatchmakingTuning,
  TickOptions,
  TickResult,
  UpdateFormulasInputRaw,
} from './matchmaking';
export {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
  MATCHMAKING_PAYLOAD_LIMITS,
} from './payload-limits';
export type { MatchmakingSchema } from './schema';
export type {
  DistanceFormula,
  DistanceFormulaCategoricalTerm,
  DistanceFormulaNumericTerm,
  DistanceFormulaPartitionTerm,
  JoinInput,
  JoinResult,
  LeaveResult,
  MatchedParticipant,
  MatchedStatus,
  ParticipantStatus,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
  WaitingStatus,
} from './types';
export { DEFAULT_RADIUS_OPTIONS } from './types';
