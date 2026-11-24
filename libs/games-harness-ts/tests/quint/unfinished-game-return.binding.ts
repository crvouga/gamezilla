/**
 * `specs/games/unfinished-game-return.qnt` against Alice's space and every
 * device the model names: Alice's phone and computer, Bob's phone and
 * Carol's. Either Alice and Bob play a custom game under way in Alice's
 * space while Carol watches it there, or Alice has an unfinished matched
 * game with Bob, who plays it from his own space, while Carol is a guest in
 * Alice's space, after both their first moves. What a device shows is its board, the game's choices or
 * the lobby, and whether it offers to return to the game or to seek an
 * opponent.
 */

import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  returnToGame,
  returnToGameOffered,
  seekOpponentOffered,
} from '@libs/game-matchmaking-harness-ts/return-to-game';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { attemptCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { goBackFromBoard } from '@libs/game-session-harness-ts/game-navigation';
import { readSpaceView } from '@libs/game-session-harness-ts/space-game-choice';
import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  joinViaLink,
  returnToLobby,
  returnToOwnSpace,
} from '@libs/spaces-harness-ts/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { conformanceGameOf } from '../conformance-world';
import returnKeepsSpaceUnderBoard from './fixtures/matched-game-return-keeps-space-under-board.itf.json';
import returnRepeatsOnReopen from './fixtures/matched-game-return-repeats-on-reopen.itf.json';
import {
  changeSpacesMatch,
  prepareMatchedSpaces,
} from './matched-game-spaces-world';

function gameOf(w: QuintHarnessWorld) {
  return conformanceGameOf(w.ctx.variant, w.ctx.title);
}

const ALICE = 'alice';
const ALICE_COMPUTER = 'alice_phone';
const BOB = 'bob';
const CAROL = 'carol';

const ACTOR_OF: Record<string, string> = {
  'alice-phone': ALICE,
  'alice-computer': ALICE_COMPUTER,
  'bob-phone': BOB,
  'carol-phone': CAROL,
};

function actorOf(picks: Picks): string {
  const device = String(picks['device']);
  const actor = ACTOR_OF[device];
  if (actor === undefined) throw new Error(`unknown device ${device}`);
  return actor;
}

/** Which unfinished game the trace began with. */
function kindOf(w: QuintHarnessWorld): 'custom' | 'matched' {
  const kind = w.memo.get('return:kind');
  if (kind !== 'custom' && kind !== 'matched')
    throw new Error('the trace has not begun');
  return kind;
}

/** Alice's other device, signed in as her, in her space. */
async function aliceComputerJoins(w: QuintHarnessWorld): Promise<void> {
  const link = await w.s.read(readSpaceLink, ALICE);
  if (link === null) throw new Error('alice is not in a space');
  await w.s.apply(signInWithGoogleAsAccount, ALICE_COMPUTER, ALICE);
  await w.s.apply(returnToTabs, ALICE_COMPUTER);
  await w.s.apply(joinViaLink, ALICE_COMPUTER, link);
}

async function begin(w: QuintHarnessWorld, kind: string): Promise<void> {
  w.memo.set('return:kind', kind);
  if (kind === 'custom') {
    await w.s.apply(establishCustomGame, gameOf(w).shared.id, {
      watchers: [CAROL],
    });
  } else {
    await prepareMatchedSpaces(w);
    // After both first moves, so either of them may resign it.
    await changeSpacesMatch(w, ALICE, 'move');
    await changeSpacesMatch(w, BOB, 'move');
    const link = await w.s.read(readSpaceLink, ALICE);
    if (link === null) throw new Error('alice is not in a space');
    await w.s.apply(joinViaLink, CAROL, link);
  }
  await aliceComputerJoins(w);
}

/** A participant's device resigns the unfinished game from its board. */
async function resign(w: QuintHarnessWorld, actor: string): Promise<void> {
  if (kindOf(w) === 'custom') {
    await w.s.apply(attemptCustomGame, actor, { operation: 'resign' });
    return;
  }
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game === null) throw new Error(`${actor} shows no matched game`);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name: 'resignMultiplayer',
    args: { gameId: game.id, requestId: `return-resign-${actor}` },
  });
}

/** What `actor`'s device shows: the lobby, the game's choices, or the board. */
async function viewOf(w: QuintHarnessWorld, actor: string): Promise<string> {
  if (!(await w.quiet.read(activeSpaceVisible, actor))) return 'lobby';
  const shown = await w.quiet.read(readSpaceView, actor, gameOf(w).shared.id);
  return shown === 'game' || shown === 'choice' ? 'choices' : 'board';
}

async function observeDevices(w: QuintHarnessWorld) {
  const view = new Map<string, string>();
  const returnOffered = new Map<string, boolean>();
  const seekOffered = new Map<string, boolean>();
  for (const [device, actor] of Object.entries(ACTOR_OF)) {
    view.set(device, await viewOf(w, actor));
    returnOffered.set(
      device,
      (await w.quiet.read(returnToGameOffered, actor)) !== null
    );
    seekOffered.set(device, await w.quiet.read(seekOpponentOffered, actor));
  }
  return { view, returnOffered, seekOffered };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'unfinished-game-return',
  traces: 32,
  maxSteps: 10,
  verifySteps: 2,
  timeoutMs: 300_000,
  regressions: [
    {
      // regression: matched-game-return-keeps-space-under-board
      id: 'matched-game-return-keeps-space-under-board',
      title:
        'Going back to the lobby after returning to a matched game leaves the space on its board',
      seed: '0x67932',
      itf: returnKeepsSpaceUnderBoard,
    },
    {
      // regression: matched-game-return-repeats-on-reopen
      id: 'matched-game-return-repeats-on-reopen',
      title:
        'Reopening the app after returning to a matched game leaves the space on its choices',
      seed: '0x67932',
      itf: returnRepeatsOnReopen,
    },
  ],
  actions: {
    init: (w, picks: Picks) => begin(w, String(picks['kind'])),
    backToGameChoice: async (w, picks: Picks) => {
      const actor = actorOf(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(goBackFromBoard, actor);
    },
    goBackToLobby: (w, picks: Picks) =>
      w.s.apply(returnToLobby, actorOf(picks)),
    returnToSpace: async (w, picks: Picks) => {
      const actor = actorOf(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(returnToOwnSpace, actor);
    },
    returnToGame: async (w, picks: Picks) => {
      const actor = actorOf(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(returnToGame, actor);
    },
    resignGame: async (w, picks: Picks) => {
      const actor = actorOf(picks);
      await w.s.apply(focusActor, actor);
      await resign(w, actor);
    },
    reopenApp: (w, picks: Picks) => w.s.apply(restartApp, actorOf(picks)),
    loseConnection: async (w, picks: Picks) => {
      await w.s.apply(partition, actorOf(picks));
      await w.s.advanceTime(1_000);
    },
    connectionReturns: (w, picks: Picks) =>
      w.s.apply(restoreActorConnection, actorOf(picks)),
  },
  observe: (w) => observeDevices(w),
});
