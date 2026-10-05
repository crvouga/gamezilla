/**
 * The rating change a solver sees for the puzzle on the board: this play's
 * change once its outcome is decided, "unrated" when an earlier play of the
 * same puzzle already moved the rating (§8: a puzzle moves it once, ever).
 */

import type { ChessPuzzleInteractionRow } from './chess-puzzle-interaction-entities';
import { CHESS_PUZZLE_INTERACTION_KIND } from './chess-puzzle-interaction-entities';
import type { ChessPuzzleRatingEvent } from './chess-puzzle-rating-event';
import { ratingEventDelta } from './chess-puzzle-rating-event';
import { compareCodeUnit } from './code-unit-compare';

export type PuzzleRatingChange =
  | { readonly kind: 'none' }
  | { readonly kind: 'rated'; readonly delta: number }
  | { readonly kind: 'unrated' };

export function derivePuzzleRatingChange(args: {
  readonly puzzleId: string;
  /** This player's interaction rows (any puzzles; filtered here). */
  readonly interactions: readonly ChessPuzzleInteractionRow[];
  readonly ratingEvents: readonly ChessPuzzleRatingEvent[];
}): PuzzleRatingChange {
  const event = args.ratingEvents.find((e) => e.puzzleId === args.puzzleId);
  if (event === undefined) return { kind: 'none' };
  let playStart: string | null = null;
  for (const row of args.interactions) {
    if (
      row.puzzleId === args.puzzleId &&
      row.kind === CHESS_PUZZLE_INTERACTION_KIND.started &&
      (playStart === null || compareCodeUnit(row.at, playStart) > 0)
    ) {
      playStart = row.at;
    }
  }
  if (playStart !== null && compareCodeUnit(event.at, playStart) < 0) {
    return { kind: 'unrated' };
  }
  return { kind: 'rated', delta: ratingEventDelta(event) };
}
