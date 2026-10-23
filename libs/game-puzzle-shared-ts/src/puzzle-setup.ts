/**
 * Setting a puzzle up and replaying its line, over any game's rules. A
 * puzzle is played from its own position, so every action is played with
 * no earlier history: the position is all the game needs.
 */

import type { PuzzlesCapability } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type {
  GameRules,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';

/** A game offering puzzles: its rules and what it supplies for puzzles. */
export type PuzzleGame = {
  readonly rules: GameRules;
  readonly puzzles: PuzzlesCapability;
};

/** An action as the game accepted it, and what it reached. */
export type PlayedPuzzleAction = {
  /** The game's one spelling of the action (`judge.canonical`). */
  readonly action: string;
  readonly played: PlayedPosition;
};

/** The game's one spelling of `action` in `position`. */
export function canonicalAction(
  game: PuzzleGame,
  position: string,
  action: string
): string {
  const trimmed = action.trim();
  return game.puzzles.judge?.canonical?.(position, trimmed) ?? trimmed;
}

/** Play `action` in `position` as the game spells it; `null` when refused. */
export function playPuzzleAction(
  game: PuzzleGame,
  position: string,
  action: string
): PlayedPuzzleAction | null {
  const canonical = canonicalAction(game, position, action);
  const played = game.rules.play(position, canonical, '', []);
  return played === null ? null : { action: canonical, played };
}

export type PuzzleSetup =
  | {
      readonly kind: 'ready';
      /** Recorded actions already applied at the solver's starting position. */
      readonly solveIdx: 0 | 1;
      /** The solver's starting position, after setup only when there is an opponent. */
      readonly displayPosition: string;
      /** The side the solver plays throughout the line. */
      readonly solverSide: GameSide;
      /** Solved only when no solver move remains after setup. */
      readonly status: 'solving' | 'solved';
    }
  | { readonly kind: 'invalid' };

/**
 * Validate the first action and apply it only for an opponent setup. Anything the game
 * refuses makes the puzzle `invalid`, one terminal status every device
 * shows alike.
 */
export function setupPuzzle(
  game: PuzzleGame,
  position: string,
  line: readonly string[]
): PuzzleSetup {
  const setup = line[0];
  if (setup === undefined || !game.rules.recognizes(position))
    return { kind: 'invalid' };
  const played = playPuzzleAction(game, position, setup);
  if (played === null) return { kind: 'invalid' };
  const layout = puzzleLineLayout(game.puzzles);
  return {
    kind: 'ready',
    solveIdx: layout.start,
    displayPosition: layout.start === 0 ? position : played.played.position,
    solverSide: played.played.turn,
    status: line.length <= layout.start ? 'solved' : 'solving',
  };
}

/**
 * The positions after each of the line's first `through` actions, from the
 * puzzle's position; it stops at the first action the game refuses, and is
 * empty for a position the game does not recognise.
 */
export function positionTrail(
  game: PuzzleGame,
  position: string,
  line: readonly string[],
  through: number
): readonly string[] {
  const trail: string[] = [];
  if (!game.rules.recognizes(position)) return trail;
  let current = position;
  for (const action of line.slice(0, Math.max(0, through))) {
    const played = playPuzzleAction(game, current, action);
    if (played === null) return trail;
    current = played.played.position;
    trail.push(current);
  }
  return trail;
}

/**
 * The position after `solveIdx` actions of the line (as far as the game
 * plays it). Index zero is the supplied position for solver-only puzzles;
 * an unavailable position is `null`.
 */
export function positionAt(
  game: PuzzleGame,
  position: string,
  line: readonly string[],
  solveIdx: number
): string | null {
  if (
    solveIdx === 0 &&
    puzzleLineLayout(game.puzzles).start === 0 &&
    game.rules.recognizes(position)
  )
    return position;
  return positionTrail(game, position, line, solveIdx).at(-1) ?? null;
}
