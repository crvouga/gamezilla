/**
 * The rating change a solver sees for the puzzle on the board: this play's
 * change once its outcome is decided, "unrated" when an earlier play of the
 * same puzzle already moved the rating (§8: a puzzle moves it once, ever).
 */

import type { ChessPuzzleInteractionRow } from './chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  isOutcomeKind,
} from './chess-puzzle-interaction-entities';
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
  const rows = args.interactions.filter((r) => r.puzzleId === args.puzzleId);
  const starts = rows.filter(
    (r) => r.kind === CHESS_PUZZLE_INTERACTION_KIND.started
  );
  let playStart: string | null = null;
  for (const row of starts) {
    if (playStart === null || compareCodeUnit(row.at, playStart) > 0) {
      playStart = row.at;
    }
  }
  if (playStart === null) return rated(event);
  const start = playStart;
  if (compareCodeUnit(event.at, start) < 0) return { kind: 'unrated' };
  // A play only starts once the one before it has its outcome, so a later
  // start at the very instant an earlier play ended is still a repeat.
  const endedBefore = rows.some(
    (r) => isOutcomeKind(r.kind) && compareCodeUnit(r.at, start) <= 0
  );
  return starts.length > 1 && endedBefore ? { kind: 'unrated' } : rated(event);
}

function rated(event: ChessPuzzleRatingEvent): PuzzleRatingChange {
  return { kind: 'rated', delta: ratingEventDelta(event) };
}
