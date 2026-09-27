/**
 * The critical journeys' host in the sim: one actor on the full
 * composition, every gesture applied as a scenario action (pumped virtual
 * time). Each scenario opens a fresh sim, so nothing needs undoing.
 */

import {
  confirmSignedIn,
  type JourneyGestures,
  type JourneyHost,
} from '@libs/runtime/sim/critical-journeys';
import {
  actorUi,
  scenarioAction,
  signInWithGoogle,
  spawnActor,
} from '@libs/sim-harness';
import type { SimWorld } from '@libs/sim-harness/spec/world';

const ACTOR = 'alice';

const journeyGestures = scenarioAction({
  name: 'journeyGestures',
  describe: (_actorId: string, name: string, _gestures: JourneyGestures) =>
    name,
  act: async (s, actorId: string, _name: string, gestures: JourneyGestures) => {
    await gestures(await actorUi(s, actorId));
  },
});

export function simJourneyHost(w: SimWorld): JourneyHost {
  const act = (name: string, gestures: JourneyGestures) =>
    w.s.apply(journeyGestures, ACTOR, name, gestures);
  return {
    runId: 'sim',
    browser: null,
    // The sim runs the test build: the puzzle board carries its answers.
    showsPuzzleAnswers: true,
    open: async (access) => {
      if (access === 'anonymous') {
        await w.s.apply(spawnActor, ACTOR);
        return;
      }
      await w.s.apply(signInWithGoogle, ACTOR);
      // The production runner's post-sign-in check, proven on the sim's session.
      await act('confirmSignedIn', confirmSignedIn);
    },
    act,
    defer: () => undefined,
    settle: () => undefined,
  };
}
