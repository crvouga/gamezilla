import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { sokobanPuzzleContent } from './sokoban-puzzle-content';

export const sokobanGameShared = defineGame({
  id: 'sokoban',
  puzzleContent: sokobanPuzzleContent,
});
