/**
 * Test / harness host seam for `@pkgs/matchmaking`.
 * Import from `@pkgs/matchmaking-harness` only — not for product apps/libs.
 */

export type {
  HarnessParticipant,
  HarnessReplica,
  MatchmakingHarnessBackend,
} from './api';
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
  HARNESS_AUTH_HEADERS,
  harnessRequireAuth,
  join,
  lastLeave,
  lastTick,
  lastUpdate,
  leave,
  type MatchmakingArgs,
  type MatchmakingHarness,
  matchmaking,
  participantIds,
  ready,
  replicaIds,
  statusAcrossReplicas,
  statusById,
  statuses,
  statusOf,
  tick,
  tickAll,
  tickAllWith,
  updateFormulas,
} from './scenario';
