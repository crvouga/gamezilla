/**
 * `specs/spaces/space-unreachable.qnt` against the friends composition:
 * Alice hosts a space and goes back to her lobby; the product can forget
 * that space without telling her device. Returning, trying again and the
 * connection go through the app as a person uses it. Read back: whether
 * Alice is in the lobby, in her space or told it can't be reached, and
 * whether her lobby lists her space while she is there.
 */

import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  createSpace,
  openSpacesTab,
  returnToLobby,
  returnToOwnSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { spaceScreenOf } from '@libs/spaces-harness-ts/space-screen-read';
import {
  forgetSpace,
  tryReachingSpaceAgain,
} from '@libs/spaces-harness-ts/space-unreachable';
import {
  activeSpaceVisible,
  lobbySpaceCardVisible,
  readSpaceLink,
  spaceUnreachableShown,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const ACTOR = 'alice';
const LINK = 'unreachable-space-link';

/** Longer than the app waits before saying a space can't be reached. */
const ANSWER_MS = 12_000;
/** Long enough for a device to notice its connection went or came back. */
const NOTICE_MS = 2_000;

function link(w: QuintHarnessWorld): string {
  const value = w.memo.get(LINK);
  if (typeof value !== 'string') throw new Error('alice hosts no space');
  return value;
}

async function whereaboutsOf(w: QuintHarnessWorld): Promise<string> {
  if (await w.quiet.read(spaceUnreachableShown, ACTOR)) {
    return "can't be reached";
  }
  if (await w.quiet.read(activeSpaceVisible, ACTOR)) return 'own space';
  const screen = await w.quiet.read(spaceScreenOf, ACTOR);
  return screen === 'lobby' ? 'lobby' : `(${screen})`;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-unreachable',
  traces: 8,
  maxSteps: 8,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, ACTOR);
      await w.s.apply(createSpace, ACTOR);
      const hosted = await w.s.read(readSpaceLink, ACTOR);
      if (hosted === null) throw new Error('alice opened no space');
      w.memo.set(LINK, hosted);
      await w.s.apply(returnToLobby, ACTOR);
    },
    // The product forgets the space, as a rebuilt environment does, and the
    // app starts over against it; Alice's device keeps its copy.
    spaceNoLongerExists: async (w) => {
      await w.s.apply(forgetSpace, link(w));
      await w.s.apply(restartApp, ACTOR);
      await w.s.apply(openSpacesTab, ACTOR);
    },
    returnToSpace: async (w) => {
      await w.s.apply(returnToOwnSpace, ACTOR);
      await w.s.advanceTime(ANSWER_MS);
    },
    tryAgain: async (w) => {
      await w.s.apply(tryReachingSpaceAgain, ACTOR);
      await w.s.advanceTime(ANSWER_MS);
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(NOTICE_MS);
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, String(picks['person']));
      await w.s.advanceTime(ANSWER_MS);
    },
  },
  observe: async (w) => {
    const whereabouts = await whereaboutsOf(w);
    const lobby =
      whereabouts === 'lobby' &&
      (await w.quiet.read(lobbySpaceCardVisible, ACTOR, link(w)));
    return { whereabouts, lobby };
  },
});
