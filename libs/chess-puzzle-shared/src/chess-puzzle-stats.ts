import { deriveCurrentStreak } from './chess-puzzle-derive';
import type {
  ChessPuzzleInteractionRow,
  ChessPuzzleOutcomeKind,
} from './chess-puzzle-interaction-entities';
import {
  isProvisionalPuzzleRating,
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
} from './chess-puzzle-rating';
import type { ChessPuzzleRatingEvent } from './chess-puzzle-rating-event';
import { ratingEventDelta } from './chess-puzzle-rating-event';
import { compareCodeUnit } from './code-unit-compare';

export type ChessPuzzleStats = {
  readonly currentRating: number;
  readonly ratingDeviation: number;
  /** §8 "?" marker: the rating is still too uncertain to show plainly. */
  readonly provisional: boolean;
  readonly totalPlayed: number;
  readonly totalSolved: number;
  readonly accuracy: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Rating after each rated attempt, oldest first, seeded with the start. */
  readonly ratingSeries: readonly number[];
};

export type ChessPuzzleGameLogEntry = {
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: ChessPuzzleOutcomeKind;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly at: string;
};

/** Rating events oldest first — the order the server applied them in. */
export function sortRatingEventsAscending(
  events: readonly ChessPuzzleRatingEvent[]
): readonly ChessPuzzleRatingEvent[] {
  return [...events].sort((a, b) => compareCodeUnit(a.at, b.at));
}

function deriveBestStreak(events: readonly ChessPuzzleRatingEvent[]): number {
  let best = 0;
  let current = 0;
  for (const event of events) {
    if (event.outcome === 'solved') {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export type ChessPuzzleStatsInput = {
  /** The synced profile row (server-authoritative once it lands). */
  readonly profileRating: number;
  readonly profileRatingDeviation: number;
  readonly ratingEvents: readonly ChessPuzzleRatingEvent[];
  readonly interactions: readonly ChessPuzzleInteractionRow[];
};

export function deriveChessPuzzleStats(
  args: ChessPuzzleStatsInput
): ChessPuzzleStats {
  const events = sortRatingEventsAscending(args.ratingEvents);
  const totalPlayed = events.length;
  const totalSolved = events.filter((e) => e.outcome === 'solved').length;
  const accuracy =
    totalPlayed > 0 ? Math.round((totalSolved / totalPlayed) * 100) : 0;
  const first = events[0];
  const seedRating = first?.ratingBefore ?? PUZZLE_RATING_DEFAULT;
  const rating =
    args.profileRating > 0 ? args.profileRating : PUZZLE_RATING_DEFAULT;
  const ratingDeviation =
    args.profileRatingDeviation > 0
      ? args.profileRatingDeviation
      : PUZZLE_RATING_DEFAULT_RD;

  return {
    currentRating: rating,
    ratingDeviation,
    provisional: isProvisionalPuzzleRating(ratingDeviation),
    totalPlayed,
    totalSolved,
    accuracy,
    currentStreak: deriveCurrentStreak(args.interactions),
    bestStreak: deriveBestStreak(events),
    ratingSeries: [seedRating, ...events.map((e) => e.ratingAfter)],
  };
}

/** Rated attempts newest first. */
export function deriveChessPuzzleGameLog(
  ratingEvents: readonly ChessPuzzleRatingEvent[]
): ChessPuzzleGameLogEntry[] {
  return [...sortRatingEventsAscending(ratingEvents)]
    .reverse()
    .map((event) => ({
      puzzleId: event.puzzleId,
      puzzleRating: event.puzzleRating,
      outcome: event.outcome,
      ratingBefore: event.ratingBefore,
      ratingAfter: event.ratingAfter,
      delta: ratingEventDelta(event),
      at: event.at,
    }));
}
