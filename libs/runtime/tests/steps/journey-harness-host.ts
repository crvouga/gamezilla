/**
 * The critical journeys' host in the harness: one actor on the full
 * composition, every gesture applied as a scenario action (pumped virtual
 * time). Each scenario opens a fresh harness, so nothing needs undoing.
 */

import {
  actorUi,
  scenarioAction,
  signInWithGoogle,
  spawnActor,
} from '@libs/harness';
import type { HarnessWorld } from '@libs/harness/spec/world';
import {
  confirmSignedIn,
  type JourneyGestures,
  type JourneyHost,
} from '@libs/runtime/harness/critical-journeys';

const ACTOR = 'alice';

const journeyGestures = scenarioAction({
  name: 'journeyGestures',
  describe: (_actorId: string, name: string, _gestures: JourneyGestures) =>
    name,
  act: async (s, actorId: string, _name: string, gestures: JourneyGestures) => {
    await gestures(await actorUi(s, actorId));
  },
});

export function harnessJourneyHost(w: HarnessWorld): JourneyHost {
  const act = (name: string, gestures: JourneyGestures) =>
    w.s.apply(journeyGestures, ACTOR, name, gestures);
  return {
    runId: 'harness',
    browser: null,
    // The harness runs the test build: the puzzle board carries its answers.
    showsPuzzleAnswers: true,
    open: async (access) => {
      if (access === 'anonymous') {
        await w.s.apply(spawnActor, ACTOR);
        return;
      }
      await w.s.apply(signInWithGoogle, ACTOR);
      // The production runner's post-sign-in check, proven on the harness's session.
      await act('confirmSignedIn', confirmSignedIn);
    },
    act,
    defer: () => undefined,
    settle: () => undefined,
  };
}
