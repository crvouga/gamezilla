/**
 * Test / sim host seam for `@pkgs/matchmaking`.
 * Import from `@pkgs/matchmaking/testing` only — not for product apps/libs.
 *
 * Mirrors `@pkgs/room/tests` (`testkit.ts`): this file is the package export
 * so depcruise `no-test-from-prod` allows it to reach `tests/` + `sim/`.
 */

export { openMatchmakingSimWorld } from './sim/world';
export type {
  MatchmakingSimBackend,
  MatchmakingSimWorld,
  OpenMatchmakingSimWorldArgs,
  ParticipantHandle,
  ReplicaHandle,
} from './sim/world-api';
export {
  assertMatchInvariants,
  assertStatusAgreesAcrossReplicas,
  defaultStubAuth,
  expectMatched,
  KindAttr,
  NameAttr,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
  TEST_AUTH_HEADERS,
  testNs,
  UUID_REGEX,
} from './tests/fixtures';
