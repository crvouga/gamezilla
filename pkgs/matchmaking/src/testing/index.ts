/**
 * Test-only surface for `@pkgs/matchmaking`.
 *
 * Import via `@pkgs/matchmaking/testing`. Contract runners couple only to
 * the {@link Matchmaking} port — never to Postgres or adapter internals.
 */

export { runMatchmakingAppContractTests } from './app-contract';
export {
  type BootOverrides,
  defaultStubAuth,
  defaultTestTuning,
  expectMatched,
  KindAttr,
  type MatchmakingFactory,
  NameAttr,
  pauseForJoinedAtOrdering,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  resolveConfig,
  resolveConfigWithSimIo,
  SkillAttr,
  TEST_AUTH_HEADERS,
  testNs,
  testWallIo,
  UUID_REGEX,
} from './fixtures';
export { runMatchmakingContractTests } from './matchmaking-contract';
