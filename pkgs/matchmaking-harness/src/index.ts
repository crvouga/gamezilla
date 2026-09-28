/**
 * Test / harness host seam for `@pkgs/matchmaking`: the one example app
 * every test drives, and the matchmaking system that boots it behind
 * replicas sharing one store.
 * Import from `@pkgs/matchmaking-harness` only — not for product apps/libs.
 */

export type {
  HarnessParticipant,
  HarnessReplica,
  MatchmakingHarnessBackend,
} from './api';
export { registerTestCrashHandler } from './crash-handler';
export {
  changeRange,
  type ExamplePartition,
  exampleAppSchema,
  exampleNs,
  lastWait,
  ModeAttr,
  NameAttr,
  RatingAttr,
  RegionAttr,
  ratingWithin,
  stopWaiting,
  type WaitForMatchSpec,
  waitForMatch,
} from './example-app';
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
  matchFingerprint,
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
