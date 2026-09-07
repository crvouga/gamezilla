import type { GameClientDefinition } from '@libs/spaces/public/game';
import { Trans } from '@lingui/solid/macro';

import { CHESS_GAME_ID } from './chess-game';
import { ChessMainMenu } from './chess-main-menu-view';

export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: <Trans>Chess</Trans>,
  caption: <Trans>Puzzles, stats, and custom games</Trans>,
  MainMenu: ChessMainMenu,
};
