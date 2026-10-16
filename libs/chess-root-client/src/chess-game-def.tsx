import { ReconcilePuzzleResult } from '@libs/chess-puzzle-client/reconcile-puzzle-result';
import { CHESS_GAME_ID } from '@libs/chess-puzzle-shared/chess-game';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import { chessPresentation } from './chess-game-presentation';
import { ChessMainMenu } from './chess-main-menu-view';

export const chessGameClient: GameClientDefinition = {
  presentation: chessPresentation,
  id: CHESS_GAME_ID,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  MainMenu: ChessMainMenu,
  SessionEffects: ReconcilePuzzleResult,
};
