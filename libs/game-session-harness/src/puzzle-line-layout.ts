import type { PuzzleLinePoint } from '@libs/harness/parameter-types';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import { rulesTrail } from './game-puzzle-laws';
import type { HarnessGame } from './harness-game';
import type { PuzzleFixture } from './known-puzzles';

/** A named point in the author's line, including its supplied position. */
export function knownPuzzleLinePoint(
  game: HarnessGame,
  fixture: PuzzleFixture,
  point: PuzzleLinePoint
): { readonly move: number; readonly of: number; readonly position: string } {
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (puzzles === undefined) throw new Error(`${game.label} offers no puzzles`);
  const layout = puzzleLineLayout(puzzles);
  const end = fixture.record.line.length;
  const move = {
    start: layout.start,
    end,
    'before-last': end - 1,
    first: 1,
    continuation: layout.start + layout.solverStep,
  }[point];
  const position = rulesTrail(game.shared.turnGame.rules, fixture.record)[move];
  if (position === undefined)
    throw new Error(`${fixture.record.id} has no ${point} position`);
  return { move, of: end, position };
}

/** The authored position one recorded action before the reached frontier. */
export function knownPuzzlePreviousPoint(
  game: HarnessGame,
  fixture: PuzzleFixture,
  reached: number
): { readonly move: number; readonly position: string } {
  const move = reached - 1;
  const position = rulesTrail(game.shared.turnGame.rules, fixture.record)[move];
  if (position === undefined)
    throw new Error(`${fixture.record.id} has no position before ${reached}`);
  return { move, position };
}
