import type { GameClientDefinition } from '@libs/spaces/public/game';

import { CHESS_GAME_ID } from './chess-game';
import { ChessMainMenu } from './chess-main-menu-view';

export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  MainMenu: ChessMainMenu,
};
