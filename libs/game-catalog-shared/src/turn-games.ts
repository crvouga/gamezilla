import { chessNoticeText } from '@libs/chess-rules-shared/chess-notice-text';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';
import { connectFourNoticeText } from '@libs/connect-four-shared/connect-four-notice-text';
import { connectFourRules } from '@libs/connect-four-shared/connect-four-rules';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
/** Product composition only. Reusable engines receive this value through ports. */
export const TURN_GAMES = createTurnGames([
  { rules: chessRules, controlPrefix: '', notice: chessNoticeText },
  {
    rules: connectFourRules,
    controlPrefix: 'connect-four/',
    notice: connectFourNoticeText,
  },
]);
