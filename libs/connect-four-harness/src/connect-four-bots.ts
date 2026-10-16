import { dropDisc, legalColumns } from '@libs/connect-four-shared/connect-four';
import { configureCustomGame } from '@libs/game-session-harness/custom-game-ui';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { connectFourView, establishConnectFour } from './connect-four-actions';

/** Reach tactics using ordinary human choices and the host's scheduled bot turns. */
export const establishConnectFourBotPosition = scenarioAction({
  name: 'establishConnectFourBotPosition',
  act: async (s, moves: readonly number[]) => {
    await Promise.resolve(
      establishConnectFour.act(s, {
        red: 'alice',
        yellow: 'bot',
        active: false,
      })
    );
    await configureCustomGame(s, 'alice', {
      operation: 'difficulty',
      side: 'black',
      difficulty: 'hard',
    });
    await configureCustomGame(s, 'alice', { operation: 'ready' });
    await configureCustomGame(s, 'alice', { operation: 'start' });
    for (const [index, column] of moves.entries()) {
      const view = await connectFourView(s);
      await configureCustomGame(s, 'alice', {
        operation: 'move',
        uci: String(column),
        ply: view.game.moves.length,
      });
      if (index < moves.length - 1) await s.session.advanceTime(1000);
    }
  },
});

export const playConnectFourBots = scenarioAction({
  name: 'playConnectFourBots',
  act: async (s) => {
    for (let turn = 0; turn < 42; turn++) {
      const view = await connectFourView(s);
      if (view.current?.status !== 'active') return;
      await s.session.advanceTime(1000);
    }
  },
});
export async function connectFourBotTactics(s: ProductHarness) {
  const view = await connectFourView(s);
  return {
    result: view.game.result,
    immediateOpponentWin: legalColumns(view.game).some(
      (column) => dropDisc(view.game, column)?.result === view.game.turn
    ),
    gravity: view.board.every(
      (disc, index) => disc === 0 || index < 7 || view.board[index - 7] !== 0
    ),
  };
}
