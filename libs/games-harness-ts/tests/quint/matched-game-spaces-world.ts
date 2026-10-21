/**
 * One matched game of the trace's game that Alice and Bob play from their
 * own spaces, as `specs/games/matched-game-spaces.qnt`,
 * `matched-game-shared.qnt` and `matched-game-clock-recovery.qnt` follow it:
 * Alice has the first side, the moves are the game's known victory, and
 * anyone in either space may be shown it.
 */

import { multiplayerBoardShown } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import {
  givenOpponentSearch,
  pairGameOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { productClockChoice } from './matched-game-clock';
import { modelGameOf, refusedMoveOf, victoryOf } from './model-game';

/** The two people the matched game pairs, Alice on the first side. */
export const SPACE_HOSTS = ['alice', 'bob'] as const;

/** Carol's device, which joins either space later, has the app open. */
const openWatcherDevice = scenarioAction({
  name: 'openWatcherDevice',
  act: (s, actor: string) => ensureActor(s, actor),
});

/** Alice and Bob paired at `clockChoice` (the model's name), each in their own space. */
export async function prepareMatchedSpaces(
  w: QuintHarnessWorld,
  clockChoice = '5+0'
) {
  const gameId = modelGameOf(w).shared.id;
  for (const actor of SPACE_HOSTS) {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(givenGameSpace, actor);
    await w.s.apply(
      givenOpponentSearch,
      actor,
      productClockChoice(w, clockChoice)
    );
    await w.s.advanceTime(1);
  }
  await w.s.apply(pairGameOpponents, 'alice', true);
  for (const actor of SPACE_HOSTS)
    await w.s.apply(openFindingAnOpponent, actor, gameId);
  await w.s.apply(openWatcherDevice, 'carol');
}

/** The matched game both spaces show, as Alice's device holds it. */
export async function spacesMatch(w: QuintHarnessWorld) {
  const game = (await w.s.read(multiplayerView, 'alice')).game;
  if (game === null) throw new Error('The shared matched game is missing');
  return game;
}

/**
 * `actor`'s device makes the victory's next move or resigns the shared
 * matched game, as its screen sends it, whoever's turn it is.
 */
export async function changeSpacesMatch(
  w: QuintHarnessWorld,
  actor: string,
  kind: 'move' | 'resign'
) {
  const game = await spacesMatch(w);
  const sent = Number(w.memo.get('spaces:commands') ?? 0) + 1;
  w.memo.set('spaces:commands', sent);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name: kind === 'move' ? 'playMultiplayerMove' : 'resignMultiplayer',
    args: {
      gameId: game.id,
      requestId: `spaces-${String(sent)}`,
      revision: game.revision,
      uci: victoryOf(modelGameOf(w))[game.revision] ?? refusedMoveOf(w),
    },
  });
}

/** Who each device shows has won: the first side is Alice, the second Bob. */
export function winnerShown(outcome: string | null): string {
  if (outcome === 'white') return 'alice';
  if (outcome === 'black') return 'bob';
  return 'nobody';
}

/** What each device shows of the shared matched game, by the model's name for it. */
export async function readSpacesMatch(
  w: QuintHarnessWorld,
  devices: Readonly<Record<string, string>>
) {
  const shownMoves = new Map<string, number>();
  const shownWinner = new Map<string, string>();
  const canMove = new Map<string, boolean>();
  for (const [device, actor] of Object.entries(devices)) {
    const board = await w.quiet.read(multiplayerBoardShown, actor);
    shownMoves.set(device, board.revision);
    shownWinner.set(device, winnerShown(board.outcome));
    canMove.set(device, board.canMove);
  }
  return { shownMoves, shownWinner, canMove };
}
