import {
  deriveCurrentStreak,
  playOutcome,
  sliceCurrentPlay,
} from './chess-puzzle-derive';
import type { ChessPuzzleInteractionRow, ChessPuzzleOutcomeKind } from './chess-puzzle-interaction-entities';
import { isOutcomeKind } from './chess-puzzle-interaction-entities';
import { PUZZLE_RATING_DEFAULT } from './chess-puzzle-rating';
import type { ChessPuzzleRatingEvent } from './chess-puzzle-rating-event';
import { compareCodeUnit } from './code-unit-compare';

export type PuzzleCompletionOutcome = ChessPuzzleOutcomeKind;

export type PuzzleCompletion = {
  readonly outcome: PuzzleCompletionOutcome;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly streak: number;
  readonly puzzleRating: number;
  /**
   * False when the puzzle had already moved this player's rating (§8 repeat
   * attempt, §9 exhausted-pool re-serve): the result panel shows no delta.
   */
  readonly rated: boolean;
};

/** Whether `terminal` is the first outcome this puzzle ever had for the player. */
function isFirstOutcome(
  interactions: readonly ChessPuzzleInteractionRow[],
  puzzleId: string,
  terminal: ChessPuzzleInteractionRow
): boolean {
  const outcomes = interactions
    .filter((r) => r.puzzleId === puzzleId && isOutcomeKind(r.kind))
    .sort((a, b) => compareCodeUnit(a.at, b.at));
  const first = outcomes[0];
  return first !== undefined && first.at === terminal.at;
}

export type PuzzleCompletionInput = {
  /** Interaction rows for this puzzle. */
  readonly interactions: readonly ChessPuzzleInteractionRow[];
  readonly puzzleId: string;
  /** Every interaction row (streak spans puzzles). */
  readonly allInteractions: readonly ChessPuzzleInteractionRow[];
  /** Synced §8 rating ledger. */
  readonly ratingEvents: readonly ChessPuzzleRatingEvent[];
  /** Current profile rating, for the unrated case. */
  readonly profileRating: number;
};

/**
 * Completion summary for the current play of `puzzleId`, or null while the
 * play has no outcome yet. The rating numbers come from the §8 ledger row
 * the rating mutation wrote — never from a client-side recomputation.
 */
export function derivePuzzleCompletion(
  args: PuzzleCompletionInput
): PuzzleCompletion | null {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const terminal = playOutcome(play);
  if (terminal === null) return null;

  const event = args.ratingEvents.find((e) => e.puzzleId === args.puzzleId);
  const rated =
    event !== undefined &&
    isFirstOutcome(args.interactions, args.puzzleId, terminal);
  const rating =
    args.profileRating > 0 ? args.profileRating : PUZZLE_RATING_DEFAULT;
  const streak = deriveCurrentStreak(args.allInteractions);

  if (!rated) {
    return {
      outcome: terminal.kind as PuzzleCompletionOutcome,
      ratingBefore: rating,
      ratingAfter: rating,
      delta: 0,
      streak,
      puzzleRating: terminal.puzzleRating,
      rated: false,
    };
  }
  return {
    outcome: terminal.kind as PuzzleCompletionOutcome,
    ratingBefore: event.ratingBefore,
    ratingAfter: event.ratingAfter,
    delta: event.ratingAfter - event.ratingBefore,
    streak,
    puzzleRating: terminal.puzzleRating,
    rated: true,
  };
}
