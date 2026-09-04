/**
 * Test / sim host seam for `@pkgs/matchmaking`.
 * Import from `@pkgs/matchmaking/testing` only — not for product apps/libs.
 *
 * Mirrors `@pkgs/room/tests` (`testkit.ts`): this file is the package export
 * so depcruise `no-test-from-prod` allows it to reach `tests/` + `sim/`.
 */

export {
  defineMatchmakingSystem,
  join,
  MATCHMAKING_ACTIONS,
  MATCHMAKING_PROPERTIES,
  MATCHMAKING_SYSTEM,
  type MatchmakingKnobs,
  type MatchmakingSurface,
  type MatchmakingSystemDef,
  matchmaking,
  matchmakingKnobs,
  participantIds,
  SIM_AUTH_HEADERS,
  simRequireAuth,
  statuses,
  statusOf,
  tick,
  tickAll,
  tickAllWith,
} from './sim/scenario';
export type {
  MatchmakingSimBackend,
  ParticipantHandle,
  ReplicaHandle,
} from './sim/sim-api';
export {
  assertMatchInvariants,
  assertStatusAgreesAcrossReplicas,
  expectMatched,
  KindAttr,
  type MatchmakingScript,
  NameAttr,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
  testNs,
  UUID_REGEX,
} from './tests/fixtures';
