import {
  dropDisc,
  legalColumns,
} from '@libs/connect-four-shared-ts/connect-four';
import { configureGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
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
    await configureGameSession(s, 'alice', {
      operation: 'difficulty',
      side: 'black',
      difficulty: 'hard',
    });
    await configureGameSession(s, 'alice', { operation: 'ready' });
    await configureGameSession(s, 'alice', { operation: 'start' });
    for (const [index, column] of moves.entries()) {
      const view = await connectFourView(s);
      await configureGameSession(s, 'alice', {
        operation: 'move',
        uci: String(column),
        ply: view.game.moves.length,
      });
      if (index < moves.length - 1) await s.session.advanceTime(1000);
    }
  },
});

/** Whether the bot left the opponent an immediate victory. */
export async function connectFourBotTactics(s: ProductHarness) {
  const view = await connectFourView(s);
  return {
    result: view.game.result,
    immediateOpponentWin: legalColumns(view.game).some(
      (column) => dropDisc(view.game, column)?.result === view.game.turn
    ),
  };
}
