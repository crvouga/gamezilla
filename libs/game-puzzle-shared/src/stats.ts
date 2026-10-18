import { compareCodeUnit } from './code-unit-compare';
import { deriveCurrentStreak } from './derive';
import type {
  PuzzleInteractionRow,
  PuzzleOutcomeKind,
} from './interaction-entities';
import { isOutcomeKind, PUZZLE_INTERACTION_KIND } from './interaction-entities';
import {
  isProvisionalPuzzleRating,
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
} from './rating';
import type { PuzzleRatingEvent } from './rating-event';
import { ratingEventDelta } from './rating-event';

export type PuzzleStats = {
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

export type PuzzleGameLogEntry = {
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: PuzzleOutcomeKind;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  /** False for a repeat of a puzzle that already moved the rating (§8). */
  readonly rated: boolean;
  readonly at: string;
};

/** Rating events oldest first — the order the server applied them in. */
export function sortRatingEventsAscending(
  events: readonly PuzzleRatingEvent[]
): readonly PuzzleRatingEvent[] {
  return [...events].sort((a, b) => compareCodeUnit(a.at, b.at));
}

function deriveBestStreak(events: readonly PuzzleRatingEvent[]): number {
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

export type PuzzleStatsInput = {
  /** The synced profile row (server-authoritative once it lands). */
  readonly profileRating: number;
  readonly profileRatingDeviation: number;
  readonly ratingEvents: readonly PuzzleRatingEvent[];
  readonly interactions: readonly PuzzleInteractionRow[];
};

export function derivePuzzleStats(args: PuzzleStatsInput): PuzzleStats {
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

/**
 * Repeats of puzzles the ledger already rated: every later play's first
 * outcome, unrated (§8 a puzzle moves the rating once, ever).
 */
function unratedRepeats(
  ratedAt: ReadonlyMap<string, string>,
  interactions: readonly PuzzleInteractionRow[]
): PuzzleGameLogEntry[] {
  const repeats: PuzzleGameLogEntry[] = [];
  const playStart = new Map<string, string>();
  const logged = new Set<string>();
  for (const row of [...interactions].sort((a, b) =>
    compareCodeUnit(a.at, b.at)
  )) {
    const rated = ratedAt.get(row.puzzleId);
    if (rated === undefined) continue;
    if (row.kind === PUZZLE_INTERACTION_KIND.started) {
      playStart.set(row.puzzleId, row.at);
      continue;
    }
    const start = playStart.get(row.puzzleId);
    if (start === undefined || compareCodeUnit(start, rated) <= 0) continue;
    if (!isOutcomeKind(row.kind) || logged.has(`${row.puzzleId}|${start}`)) {
      continue;
    }
    logged.add(`${row.puzzleId}|${start}`);
    repeats.push({
      puzzleId: row.puzzleId,
      puzzleRating: row.puzzleRating,
      outcome: row.kind,
      ratingBefore: 0,
      ratingAfter: 0,
      delta: 0,
      rated: false,
      at: row.at,
    });
  }
  return repeats;
}

/** Every finished puzzle newest first: rated ones and unrated repeats. */
export function derivePuzzleGameLog(
  ratingEvents: readonly PuzzleRatingEvent[],
  interactions: readonly PuzzleInteractionRow[]
): PuzzleGameLogEntry[] {
  const rated = ratingEvents.map(
    (event): PuzzleGameLogEntry => ({
      puzzleId: event.puzzleId,
      puzzleRating: event.puzzleRating,
      outcome: event.outcome,
      ratingBefore: event.ratingBefore,
      ratingAfter: event.ratingAfter,
      delta: ratingEventDelta(event),
      rated: true,
      at: event.at,
    })
  );
  const ratedAt = new Map(ratingEvents.map((e) => [e.puzzleId, e.at]));
  return [...rated, ...unratedRepeats(ratedAt, interactions)].sort((a, b) =>
    compareCodeUnit(b.at, a.at)
  );
}
