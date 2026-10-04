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
  availability,
  changeRange,
  connectDevice,
  deviceConnected,
  deviceRange,
  deviceView,
  type ExamplePartition,
  exampleAppSchema,
  exampleNs,
  lastBegin,
  lastOffline,
  lastWait,
  ModeAttr,
  NameAttr,
  type PersonDevice,
  RatingAttr,
  RegionAttr,
  ratingWithin,
  repeatBegin,
  repeatChange,
  restriction,
  stopWaiting,
  timePasses,
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
export { httpRequest } from './scenario/actions';
export {
  currentOf,
  lastHttp,
  pairAllowed,
  privateStatus,
} from './scenario/observations';

export { type StoredSearch, storedSearches } from './stored-searches';
