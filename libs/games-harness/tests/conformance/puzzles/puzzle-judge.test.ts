/**
 * The platform's judge over every game offering puzzles, on its known
 * puzzles: following the solution solves it, each move as the line names
 * it, ending exactly on the line's last move; its wrong move is wrong, its
 * refused move no move, and every move its rules allow is judged, never
 * refused; where the game's puzzles show it, a win off the line solves at
 * once and a transposed solver move continues the reordered line. The laws
 * are `gamePuzzleJudgeLaws`; the expected outcomes are the fixtures'.
 */

import { test } from 'bun:test';
import { gamePuzzleJudgeLaws } from '@libs/game-session-harness/game-puzzle-laws';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  for (const law of gamePuzzleJudgeLaws(game)) test(law.name, law.check);
});
