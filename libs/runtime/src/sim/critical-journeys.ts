/**
 * Critical user journeys: the flows that must never break, written once
 * against the `@pkgs/ui-testing` `Driver` (by `data-testid`) and run twice —
 *
 * - **in `bun check`**, against the full composition in the in-process sim
 *   (`libs/runtime/tests/e2e/critical-journeys.test.tsx`), so a renamed test
 *   id or a broken flow fails the gate before it ships; and
 * - **against production**, in a real browser on the real web bundle
 *   (`apps/product/health/critical-journeys.health.ts`), on every deploy and
 *   on the Health workflow's schedule — synthetic monitoring.
 *
 * The runner sets up {@link CriticalJourney.access} before `run`: anonymous
 * is a fresh device; signed-in is a session for the synthetic-monitor user in
 * production (`SYNTHETIC_MONITOR_TOKEN`) and a simulated Google sign-in in
 * the sim.
 */

import {
  peopleSearchAnswers,
  profileAvatarSaves,
  signInAndOut,
} from './critical-journeys/account-journeys';
import {
  appBoots,
  googleSignInStarts,
} from './critical-journeys/anonymous-journeys';
import { confirmSignedIn } from './critical-journeys/journey-steps';
import type { CriticalJourney } from './critical-journeys/journey-types';
import {
  chessPuzzleOpens,
  hostAndEndSpace,
} from './critical-journeys/space-journeys';

export type {
  CriticalJourney,
  JourneyAccess,
  JourneyBrowser,
  JourneyContext,
} from './critical-journeys/journey-types';
export { confirmSignedIn };

/** Every critical journey, in the order runners execute them. */
export const CRITICAL_JOURNEYS: readonly CriticalJourney[] = [
  appBoots,
  googleSignInStarts,
  signInAndOut,
  hostAndEndSpace,
  chessPuzzleOpens,
  profileAvatarSaves,
  peopleSearchAnswers,
];
