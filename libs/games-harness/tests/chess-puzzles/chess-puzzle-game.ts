/**
 * Chess as the platform's puzzle engine sees it: its registered rules and
 * the puzzles capability it declares. These suites hold the platform's
 * puzzle setup, judge and session to chess's own puzzles and regressions.
 */
import { chessTurnGame } from '@libs/chess-sub-shared/chess-game';
import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';

const puzzles = chessTurnGame.capabilities.puzzles;
if (puzzles === undefined) throw new Error('chess offers puzzles');

export const CHESS_PUZZLE_GAME: PuzzleGame = {
  rules: chessTurnGame.rules,
  puzzles,
};
