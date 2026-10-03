/**
 * The critical journeys' host in the harness: one actor on the full
 * composition, every gesture applied as a scenario action (pumped virtual
 * time). A guest is a second actor. Each scenario opens a fresh harness,
 * so nothing needs undoing.
 */

import {
  actorUi,
  partition,
  restartApp,
  scenarioAction,
  signInWithGoogle,
  spawnActor,
} from '@libs/harness';
import type { HarnessWorld } from '@libs/harness/spec/world';
import { ensureActor } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import {
  confirmSignedIn,
  type JourneyGestures,
  type JourneyHost,
  spaceLinkFromLocation,
} from '@libs/runtime/harness/critical-journeys';

const HOST = 'alice';
const GUEST = 'guest';

const journeyGestures = scenarioAction({
  name: 'journeyGestures',
  describe: (_actorId: string, name: string, _gestures: JourneyGestures) =>
    name,
  act: async (s, actorId: string, _name: string, gestures: JourneyGestures) => {
    await gestures(await actorUi(s, actorId));
  },
});

/** A parked actor's screen reads as empty until their tree is in front. */
const focusGuest = scenarioAction({
  name: 'focusGuest',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
  },
});

const openActorLink = scenarioAction({
  name: 'openActorLink',
  act: async (s, actorId: string, link: string) => {
    await ensureActor(s, actorId);
    const actor = s.actors.get(actorId);
    if (actor === undefined) throw new Error(`${actorId} has no app`);
    await actor.openLink(link);
    await s.session.waitForIdle();
    await actor.ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
  },
});

async function actorSpaceLink(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const actor = s.actors.get(actorId);
  if (actor === undefined) throw new Error(`${actorId} has no app open`);
  return spaceLinkFromLocation(await actor.currentPath());
}

export function harnessJourneyHost(w: HarnessWorld): JourneyHost {
  const act = (name: string, gestures: JourneyGestures) =>
    w.s.apply(journeyGestures, HOST, name, gestures);
  return {
    runId: 'harness',
    browser: null,
    // The harness runs the test build: the puzzle board carries its answers.
    showsPuzzleAnswers: true,
    open: async (access) => {
      if (access === 'anonymous') {
        await w.s.apply(spawnActor, HOST);
        return;
      }
      await w.s.apply(signInWithGoogle, HOST);
      // The production runner's post-sign-in check, proven on the harness's session.
      await act('confirmSignedIn', confirmSignedIn);
    },
    act,
    actAsGuest: async (name, gestures) => {
      await w.s.apply(spawnActor, GUEST);
      await w.s.apply(focusGuest, GUEST);
      await w.s.apply(journeyGestures, GUEST, name, gestures);
    },
    spaceLink: () => w.s.read(actorSpaceLink, HOST),
    openGuest: (link) => w.s.apply(openActorLink, GUEST, link),
    offline: async () => {
      await w.s.apply(partition, HOST);
      await w.s.advanceTime(1000);
    },
    reopen: () => w.s.apply(restartApp, HOST),
    defer: () => undefined,
    settle: () => undefined,
  };
}
