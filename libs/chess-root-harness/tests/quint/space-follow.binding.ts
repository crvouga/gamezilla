/**
 * `specs/chess/space-follow.qnt` against a space the host and a guest share
 * on every device they have there. The host's choice is what those devices
 * show. An offline device keeps what it was showing. A guest is told the
 * host is offline only when no host device still has a connection.
 */

import { leaveChessMenuToGameMenu } from '@libs/chess-puzzle-harness/chess-actions';
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
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront, visible } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinViaLink,
  selectChessGame,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

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

async function viewOf(s: ProductHarness, actor: string): Promise<string> {
  await bringToFront(s, actor);
  if (await visible(s, actor, [Handles.spaceHostOffline])) {
    return 'host offline';
  }
  if (await visible(s, actor, [Handles.chessMenuPuzzle])) return 'chess';
  if (await visible(s, actor, [Handles.gameMenuChess])) return 'choice';
  return 'elsewhere';
}

async function views(w: QuintHarnessWorld): Promise<Map<string, string>> {
  const view = new Map<string, string>();
  for (const [device, actor] of Object.entries(ACTOR_OF)) {
    view.set(device, await w.quiet.read(viewOf, actor));
  }
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
    pickChess: async (w, picks: Picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(focusActor, actor);
      await w.s.apply(selectChessGame, actor);
    },
    backToGameChoice: async (w, picks: Picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(focusActor, actor);
      await w.s.apply(leaveChessMenuToGameMenu, actor);
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
