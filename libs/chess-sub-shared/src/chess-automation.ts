import { chooseChessMove } from '@libs/chess-rules-shared/automated-move';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';
import {
  chessBoardPromotionTestId,
  chessBoardSquareTestId,
} from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

export const chessAutomation: GameAutomation<Driver> = {
  rules: chessRules,
  selectControl: 'game-menu-chess',
  multiplayerControl: 'chess-menu-multiplayer',
  boardControl: 'multiplayer-board',
  choose: (position, random) => chooseChessMove(position, random)?.lan ?? null,
  async perform(ui, action) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action))
      throw new Error('Invalid automated Chess action');
    await ui
      .get(
        chessBoardSquareTestId(
          'multiplayer-board',
          action.slice(0, 2) as Square
        )
      )
      .key('enter');
    await ui
      .get(
        chessBoardSquareTestId(
          'multiplayer-board',
          action.slice(2, 4) as Square
        )
      )
      .key('enter');
    const promotion = action[4];
    if (
      promotion === 'q' ||
      promotion === 'r' ||
      promotion === 'b' ||
      promotion === 'n'
    )
      await ui
        .get(chessBoardPromotionTestId('multiplayer-board', promotion))
        .tap();
  },
};
