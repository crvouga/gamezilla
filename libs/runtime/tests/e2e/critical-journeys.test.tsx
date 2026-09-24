/**
 * Every critical journey runs here against the full composition, exactly as
 * the production health probe runs it against the live site
 * (`apps/product/health/critical-journeys.health.ts`). A renamed test id, a
 * moved button or a broken flow fails `bun check` before it can page anyone.
 *
 * Signed-in journeys sign in through the simulated Google provider here; in
 * production the synthetic-monitor session stands in for it.
 */

import { describe, expect, test } from 'bun:test';
import {
  CRITICAL_JOURNEYS,
  confirmSignedIn,
} from '@libs/runtime/sim/critical-journeys';
import {
  actorUi,
  scenarioAction,
  signInWithGoogle,
  spawnActor,
} from '@libs/sim-harness';
import { openSim } from './support/open-app-sim';

const ACTOR = 'alice';

/** The production runner's post-sign-in check, proven on the sim's session. */
const confirmJourneySignIn = scenarioAction({
  name: 'confirmJourneySignIn',
  act: async (s, actorId: string) => {
    await confirmSignedIn(await actorUi(s, actorId));
  },
});

const runCriticalJourney = scenarioAction({
  name: 'runCriticalJourney',
  act: async (s, actorId: string, journeyId: string) => {
    const journey = CRITICAL_JOURNEYS.find((j) => j.id === journeyId);
    if (journey === undefined) throw new Error(`no journey ${journeyId}`);
    await journey.run({
      ui: await actorUi(s, actorId),
      runId: 'sim',
      browser: null,
    });
  },
});

describe('critical journeys', () => {
  // Decided value: only the identity-provider hand-off needs a real browser;
  // everything else is proven here on every change.
  test('only the Google hand-off is browser-only', () => {
    expect(
      CRITICAL_JOURNEYS.filter((j) => j.requiresBrowser).map((j) => j.id)
    ).toEqual(['google-sign-in-starts']);
    const ids = CRITICAL_JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const journey of CRITICAL_JOURNEYS.filter((j) => !j.requiresBrowser)) {
    test(`${journey.id}: ${journey.title}`, async () => {
      await using s = await openSim(`critical-journey-${journey.id}`);
      if (journey.access === 'signed-in') {
        await s.apply(signInWithGoogle, ACTOR);
        await s.apply(confirmJourneySignIn, ACTOR);
      } else {
        await s.apply(spawnActor, ACTOR);
      }
      await s.apply(runCriticalJourney, ACTOR, journey.id);
    });
  }
});
