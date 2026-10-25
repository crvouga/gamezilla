import { chooseChessMove } from '@libs/chess-rules-shared-ts/automated-move';
import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import {
  chessBoardPromotionTestId,
  chessBoardSquareTestId,
} from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';

export const chessAutomation: TurnGame['turnAutomation'] = {
  choose: (position, random) => chooseChessMove(position, random)?.lan ?? null,
  async perform(ui, board, action) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action))
      throw new Error('Invalid automated Chess action');
    await ui
      .get(chessBoardSquareTestId(board, action.slice(0, 2) as Square))
      .key('enter');
    await ui
      .get(chessBoardSquareTestId(board, action.slice(2, 4) as Square))
      .key('enter');
    const promotion = action[4];
    if (
      promotion === 'q' ||
      promotion === 'r' ||
      promotion === 'b' ||
      promotion === 'n'
    )
      await ui.get(chessBoardPromotionTestId(board, promotion)).tap();
  },
};
