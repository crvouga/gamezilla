/**
 * `specs/games/space-follow.qnt` against a space the host and a guest share
 * on every device they have there, playing the trace's game. The host's
 * choice is what those devices show: the space's game choice, or the game's
 * choices once the host picks the game. An offline device keeps what it was
 * showing. A guest is told the host is offline only when no host device
 * still has a connection.
 */

import {
  goBackInGame,
  pickGame,
} from '@libs/game-session-harness/game-navigation';
import { readSpaceView } from '@libs/game-session-harness/space-game-choice';
import {
  letTimePass,
  partition,
  restoreActorConnection,
} from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { modelGameOf } from './model-game';

const PHONE = 'alice';
const COMPUTER = 'alice_phone';
const GUEST = 'bob';
const QUIET_MS = 2 * 60 * 1000;

const ACTOR_OF: Record<string, string> = {
  'alice-phone': PHONE,
  'alice-computer': COMPUTER,
  'bob-phone': GUEST,
};

function actorOf(device: string): string {
  const actor = ACTOR_OF[device];
  if (actor === undefined) throw new Error(`unknown device ${device}`);
  return actor;
}

async function views(w: QuintHarnessWorld): Promise<Map<string, string>> {
  const gameId = modelGameOf(w).shared.id;
  const view = new Map<string, string>();
  for (const [device, actor] of Object.entries(ACTOR_OF))
    view.set(device, await w.quiet.read(readSpaceView, actor, gameId));
  return view;
}

async function openSharedSpace(w: QuintHarnessWorld): Promise<void> {
  await w.s.apply(signInWithGoogle, PHONE);
  await w.s.apply(focusActor, PHONE);
  await w.s.apply(createSpace, PHONE);
  const link = await w.s.read(readSpaceLink, PHONE);
  if (link === null) throw new Error('alice has no space link');
  await w.s.apply(joinViaLink, GUEST, link);
  await w.s.apply(signInWithGoogleAsAccount, COMPUTER, PHONE);
  await w.s.apply(returnToTabs, COMPUTER);
  await w.s.apply(joinViaLink, COMPUTER, link);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-follow',
  traces: 16,
  maxSteps: 8,
  verifySteps: 2,
  timeoutMs: 300_000,
  actions: {
    init: (w) => openSharedSpace(w),
    pickGame: async (w, picks: Picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(focusActor, actor);
      await w.s.apply(pickGame, actor, modelGameOf(w).shared.id);
    },
    backToGameChoice: async (w, picks: Picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(focusActor, actor);
      await w.s.apply(goBackInGame, actor);
    },
    goQuiet: (w) => w.s.apply(letTimePass, QUIET_MS),
    loseConnection: async (w, picks: Picks) => {
      await w.s.apply(partition, actorOf(String(picks['device'])));
      await w.s.advanceTime(1_000);
    },
    connectionReturns: (w, picks: Picks) =>
      w.s.apply(restoreActorConnection, actorOf(String(picks['device']))),
  },
  observe: async (w) => ({ view: await views(w) }),
});
