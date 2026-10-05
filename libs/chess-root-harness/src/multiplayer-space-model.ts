import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { multiplayerWatcherBoard } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { sendMultiplayerCommand } from './multiplayer-commands';

export const prepareMultiplayerSpaceModel = scenarioAction({
  name: 'prepareMultiplayerSpaceModel',
  act: async (s) => {
    for (const actor of ['alice', 'bob']) {
      await Promise.resolve(signInWithGoogle.act(s, actor));
      await Promise.resolve(givenMultiplayerSpace.act(s, actor));
      await Promise.resolve(givenOpponentSearch.act(s, actor));
      await s.session.advanceTime(1);
    }
    await Promise.resolve(pairChessOpponents.act(s, 'alice'));
    for (const actor of ['alice', 'bob'])
      await Promise.resolve(openMultiplayerChess.act(s, actor));
    await ensureActor(s, 'carol');
  },
});

export const changeSpaceMatch = scenarioAction({
  name: 'changeSpaceMatch',
  act: async (s, actor: string, kind: 'move' | 'resign') => {
    const game = (await multiplayerView(s, 'alice')).game;
    if (game === null) throw new Error('The shared match is missing');
    await Promise.resolve(
      sendMultiplayerCommand.act(s, actor, {
        name: kind === 'move' ? 'playMultiplayerMove' : 'resignMultiplayer',
        args: {
          gameId: game.id,
          requestId: s.session.ports.createId(),
          revision: game.revision,
          uci: game.revision === 0 ? 'e2e4' : 'e7e5',
        },
      })
    );
  },
});

export async function readSpaceMatchModel(s: ProductHarness) {
  const shownMoves = new Map<string, number>();
  const shownWinner = new Map<string, string>();
  const canMove = new Map<string, boolean>();
  for (const actor of ['alice', 'bob', 'carol']) {
    const board = await multiplayerWatcherBoard(s, actor);
    shownMoves.set(actor, board.revision);
    shownWinner.set(
      actor,
      board.outcome === 'white'
        ? 'alice'
        : board.outcome === 'black'
          ? 'bob'
          : 'nobody'
    );
    canMove.set(actor, board.canMove);
  }
  return { shownMoves, shownWinner, canMove };
}
