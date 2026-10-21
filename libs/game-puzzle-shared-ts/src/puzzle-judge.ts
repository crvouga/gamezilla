/**
 * The verdict on one solver move against the puzzle's line, over any
 * game's rules (spec §5):
 *
 * - `illegal`: the game refuses the action here (the board snaps back, no
 *   penalty).
 * - `win`: the action wins the game for the solver, on the line's last
 *   move or earlier — another or a faster win solves the puzzle too. The
 *   game's own result outranks even contradictory stored data.
 * - `line`: the action is the line's next solver move, spelled as the
 *   game spells it (`judge.canonical`).
 * - `transposition`: the action is the solver's following line move played
 *   one turn early; the opponent's reply is still accepted and the pair
 *   reaches the same position (`judge.samePosition`) as the stored order,
 *   so the room continues on the reordered line.
 * - `wrong`: accepted by the game but none of the above.
 */

import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleGame } from './puzzle-setup';
import { canonicalAction, playPuzzleAction } from './puzzle-setup';

export type PuzzleMoveAccepted = {
  readonly kind: 'correct';
  readonly via: 'line' | 'win' | 'transposition';
  /** The game's spelling of the played action. */
  readonly action: string;
  /** How the game names it (`PlayedPosition.label`). */
  readonly label: string;
  /** The position after the solver's move (before any opponent reply). */
  readonly position: string;
  /** The line the room follows from here (differs from the stored one on a win or transposition). */
  readonly line: readonly string[];
  /** True when this move ends the puzzle. */
  readonly ends: boolean;
};

export type PuzzleMoveJudgement =
  | PuzzleMoveAccepted
  | {
      readonly kind: 'wrong';
      readonly action: string;
      readonly label: string;
    }
  | { readonly kind: 'illegal' };

/** Play `actions` in order; the position reached, or `null` when one is refused. */
function playLine(
  game: PuzzleGame,
  position: string,
  actions: readonly string[]
): string | null {
  let current = position;
  for (const action of actions) {
    const played = playPuzzleAction(game, current, action);
    if (played === null) return null;
    current = played.played.position;
  }
  return current;
}

/** The line with successive solver moves swapped, preserving any reply between them. */
function transposedLine(args: {
  readonly game: PuzzleGame;
  readonly position: string;
  readonly line: readonly string[];
  readonly idx: number;
  readonly played: string;
}): readonly string[] | null {
  const { game, position, line, idx, played } = args;
  const stride = puzzleLineLayout(game.puzzles).solverStep;
  const expected = line[idx];
  const between = line.slice(idx + 1, idx + stride);
  const later = line[idx + stride];
  if (expected === undefined || later === undefined) return null;
  if (played !== later) return null;
  const stored = playLine(game, position, [expected, ...between, later]);
  const swapped = playLine(game, position, [later, ...between, expected]);
  if (stored === null || swapped === null) return null;
  const same =
    game.puzzles.judge?.samePosition ?? ((a: string, b: string) => a === b);
  if (!same(stored, swapped)) return null;
  const transposed = [...line];
  transposed[idx] = later;
  transposed[idx + stride] = expected;
  return transposed;
}

export function judgePuzzleAction(args: {
  readonly game: PuzzleGame;
  /** The position the solver moved from. */
  readonly position: string;
  /** The line being followed, in the capability's declared layout. */
  readonly line: readonly string[];
  /** Index of the expected solver move in `line`. */
  readonly idx: number;
  /** The side the solver plays. */
  readonly solverSide: GameSide;
  readonly action: string;
}): PuzzleMoveJudgement {
  const { game, position, line, idx } = args;
  const played = playPuzzleAction(game, position, args.action);
  if (played === null) return { kind: 'illegal' };
  const accept = (
    via: PuzzleMoveAccepted['via'],
    followed: readonly string[],
    ends: boolean
  ): PuzzleMoveAccepted => ({
    kind: 'correct',
    via,
    action: played.action,
    label: played.played.label,
    position: played.played.position,
    line: followed,
    ends,
  });
  if (played.played.winner === args.solverSide)
    return accept('win', [...line.slice(0, idx), played.action], true);
  const expected = line[idx];
  if (
    expected !== undefined &&
    canonicalAction(game, position, expected) === played.action
  )
    return accept('line', line, idx + 1 >= line.length);
  const transposed = transposedLine({
    game,
    position,
    line,
    idx,
    played: played.action,
  });
  if (transposed !== null) return accept('transposition', transposed, false);
  return { kind: 'wrong', action: played.action, label: played.played.label };
}
