import { deriveCurrentStreak } from './chess-puzzle-derive';
import type {
  ChessPuzzleInteractionRow,
  ChessPuzzleOutcomeKind,
} from './chess-puzzle-interaction-entities';
import {
  type ProjectedPuzzleEloEntry,
  PUZZLE_ELO_DEFAULT,
  projectPuzzleEloFromInteractions,
} from './chess-puzzle-rating';

export type ChessPuzzleStats = {
  readonly currentElo: number;
  readonly totalPlayed: number;
  readonly totalSolved: number;
  readonly accuracy: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly eloSeries: readonly number[];
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

function deriveBestStreak(entries: readonly ProjectedPuzzleEloEntry[]): number {
  let best = 0;
  let current = 0;
  for (const entry of entries) {
    if (entry.outcome === 'solved') {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export function deriveChessPuzzleStats(args: {
  interactions: readonly ChessPuzzleInteractionRow[];
}): ChessPuzzleStats {
  const projected = projectPuzzleEloFromInteractions(args.interactions);
  const totalPlayed = projected.ratedGames;
  const totalSolved = projected.entries.filter(
    (e) => e.outcome === 'solved'
  ).length;
  const accuracy =
    totalPlayed > 0 ? Math.round((totalSolved / totalPlayed) * 100) : 0;

  return {
    currentElo:
      projected.ratedGames > 0 ? projected.rating : PUZZLE_ELO_DEFAULT,
    totalPlayed,
    totalSolved,
    accuracy,
    currentStreak: deriveCurrentStreak(args.interactions),
    bestStreak: deriveBestStreak(projected.entries),
    eloSeries: projected.eloSeries,
  };
}

export function deriveChessPuzzleGameLog(
  interactions: readonly ChessPuzzleInteractionRow[]
): ChessPuzzleGameLogEntry[] {
  const projected = projectPuzzleEloFromInteractions(interactions);
  return [...projected.entries].reverse();
}
