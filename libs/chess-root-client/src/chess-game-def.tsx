import { CHESS_GAME_ID } from '@libs/chess-puzzle-shared/chess-game';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import { ChessMainMenu } from './chess-main-menu-view';

export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  MainMenu: ChessMainMenu,
};
