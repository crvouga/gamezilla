/**
 * Public port of `@pkgs/matchmaking`.
 *
 * Import via `@pkgs/matchmaking/interface`. Adapters live at
 * `@pkgs/matchmaking-sql`.
 * Sim / scenario tests import only this surface (+ `@pkgs/matchmaking-sim`).
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
export type { InsertJoinAttrs } from './join-helpers';
export {
  assertDistanceFormulasInput,
  assertWireFormulasInput,
  MAX_FORMULAS_PER_PARTICIPANT,
  resolveGroupSize,
  resolveJoinAttrs,
} from './join-helpers';
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
  _MatchPassResult,
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
