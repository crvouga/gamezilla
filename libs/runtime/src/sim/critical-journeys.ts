/**
 * Critical user journeys: the flows that must never break, specified in
 * `specs/journeys/` and driven through the `@pkgs/ui-testing` `Driver` (by
 * `data-testid`) — run twice:
 *
 * - **in `bun check`**, against the full composition in the in-process sim
 *   (`@libs/runtime#test:e2e`), so a renamed test id or a broken flow fails
 *   the gate before it ships; and
 * - **against production**, in a real browser on the real web bundle
 *   (`@apps/product#health`), on every deploy and on the Health workflow's
 *   schedule — synthetic monitoring.
 *
 * The step definitions live in `libs/runtime/tests/steps/journeys.steps.ts`;
 * each runner hands them a {@link JourneyHost}. Signed in is a session for
 * the synthetic-monitor user in production (`SYNTHETIC_MONITOR_TOKEN`) and a
 * simulated Google sign-in in the sim.
 */

export {
  expectAvatarSeed,
  expectNoSearchResults,
  expectSignInOffered,
  saveAvatar,
  searchPeople,
  signOut,
} from './critical-journeys/account-gestures';
export {
  appBooted,
  expectGoogleHandOff,
  startGoogleSignIn,
} from './critical-journeys/anonymous-gestures';
export {
  atTabShell,
  confirmSignedIn,
  endActiveSpace,
  hostSpace,
} from './critical-journeys/journey-gestures';
export type {
  JourneyAccess,
  JourneyBrowser,
  JourneyGestures,
  JourneyHost,
  JourneyWorld,
} from './critical-journeys/journey-types';
export {
  expectGamesOffered,
  expectPuzzlePlayable,
  expectSpaceEnded,
  startChessPuzzle,
} from './critical-journeys/space-gestures';
