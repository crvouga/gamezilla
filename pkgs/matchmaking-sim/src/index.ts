/**
 * Test / sim host seam for `@pkgs/matchmaking`.
 * Import from `@pkgs/matchmaking-sim` only — not for product apps/libs.
 */

export {
  assertMatchInvariants,
  assertStatusAgreesAcrossReplicas,
  expectMatched,
  KindAttr,
  type MatchmakingScript,
  matchFingerprint,
  NameAttr,
  RatingAttr,
  RegionAttr,
  ratingWithin,
  registerTestCrashHandler,
  SkillAttr,
  testNs,
  UUID_REGEX,
} from './fixtures';
export {
  join,
  lastLeave,
  lastTick,
  lastUpdate,
  leave,
  type MatchmakingArgs,
  type MatchmakingSim,
  matchmaking,
  participantIds,
  ready,
  replicaIds,
  SIM_AUTH_HEADERS,
  simRequireAuth,
  statusAcrossReplicas,
  statusById,
  statuses,
  statusOf,
  tick,
  tickAll,
  tickAllWith,
  updateFormulas,
} from './scenario';
export type {
  MatchmakingSimBackend,
  SimParticipant,
  SimReplica,
} from './sim-api';
