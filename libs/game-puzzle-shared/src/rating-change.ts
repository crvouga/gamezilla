/**
 * The rating change a solver sees for the puzzle on the board: this play's
 * change once its outcome is decided, "unrated" when an earlier play of the
 * same puzzle already moved the rating (§8: a puzzle moves it once, ever).
 */

import { compareCodeUnit } from './code-unit-compare';
import type { PuzzleInteractionRow } from './interaction-entities';
import { isOutcomeKind, PUZZLE_INTERACTION_KIND } from './interaction-entities';
import type { PuzzleRatingEvent } from './rating-event';
import { ratingEventDelta } from './rating-event';

export type PuzzleRatingChange =
  | { readonly kind: 'none' }
  | { readonly kind: 'rated'; readonly delta: number }
  | { readonly kind: 'unrated' };

export function derivePuzzleRatingChange(args: {
  readonly puzzleId: string;
  /** This player's interaction rows (any puzzles; filtered here). */
  readonly interactions: readonly PuzzleInteractionRow[];
  readonly ratingEvents: readonly PuzzleRatingEvent[];
}): PuzzleRatingChange {
  const event = args.ratingEvents.find((e) => e.puzzleId === args.puzzleId);
  if (event === undefined) return { kind: 'none' };
  const rows = args.interactions.filter((r) => r.puzzleId === args.puzzleId);
  const starts = rows.filter((r) => r.kind === PUZZLE_INTERACTION_KIND.started);
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

function rated(event: PuzzleRatingEvent): PuzzleRatingChange {
  return { kind: 'rated', delta: ratingEventDelta(event) };
}
