/**
 * The critical journeys' host in the harness: one actor on the full
 * composition, every gesture applied as a scenario action (pumped virtual
 * time). A guest is a second actor. Each scenario opens a fresh harness,
 * so nothing needs undoing.
 */

import { restartApp, spawnActor } from '@libs/harness-ts/actions';
import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { setWorkOfflineFromCurrentPlace } from '@libs/runtime-harness-ts/app-settings';
import { confirmSignedIn } from '@libs/runtime-harness-ts/journey-gestures';
import type {
  JourneyGestures,
  JourneyHost,
} from '@libs/runtime-harness-ts/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness-ts/journey-types';
import { harnessJourneyPeerDevice } from './journey-peer-device';

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
const focusActor = scenarioAction({
  name: 'focusActor',
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

export function harnessJourneyHost(
  w: Pick<HarnessWorld, 's'>
): JourneyHost {
  let guestId = GUEST;
  const act = async (name: string, gestures: JourneyGestures) => {
    // The guest's last gesture parks Alice. An instant visibility check then
    // reads her game as gone and the journey tries to host another space.
    await w.s.apply(focusActor, HOST);
    await w.s.apply(journeyGestures, HOST, name, gestures);
  };
  const actAsGuest: JourneyHost['actAsGuest'] = async (name, gestures) => {
    await w.s.apply(focusActor, guestId);
    await w.s.apply(journeyGestures, guestId, name, gestures);
  };
  return {
    runId: 'harness',
    now: () => w.s.read((s) => s.session.ports.clock.now()),
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
    peerDevice: harnessJourneyPeerDevice(w, {
      current: () => guestId,
      select: (id) => {
        guestId = id;
      },
      account: GUEST,
      act: actAsGuest,
    }),
    openPeer: async (access) => {
      await w.s.apply(
        access === 'signed-in' ? signInWithGoogle : spawnActor,
        GUEST
      );
      await w.s.apply(focusActor, GUEST);
      if (access === 'signed-in')
        await w.s.apply(
          journeyGestures,
          GUEST,
          'confirmSignedIn',
          confirmSignedIn
        );
    },
    actAsGuest,
    spaceLink: () => w.s.read(actorSpaceLink, HOST),
    openLink: (link) => w.s.apply(openActorLink, HOST, link),
    openGuest: (link) => w.s.apply(openActorLink, guestId, link),
    offline: async () => {
      // regression: journey-offline-live-browser-capability
      await w.s.apply(setWorkOfflineFromCurrentPlace, HOST, true);
      await w.s.advanceTime(1000);
    },
    online: () => w.s.apply(setWorkOfflineFromCurrentPlace, HOST, false),
    reopen: () => w.s.apply(restartApp, HOST),
    defer: () => undefined,
    settle: () => undefined,
  };
}
