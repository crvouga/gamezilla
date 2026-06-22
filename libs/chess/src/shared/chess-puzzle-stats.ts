import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleInteractionRow,
} from './chess-puzzle-interaction-entities';
import { deriveCurrentStreak } from './chess-puzzle-derive';

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
  readonly outcome: 'solved' | 'abandoned';
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly at: string;
};

function isTerminalKind(kind: ChessPuzzleInteractionKind): boolean {
  return (
    kind === CHESS_PUZZLE_INTERACTION_KIND.solved ||
    kind === CHESS_PUZZLE_INTERACTION_KIND.abandoned
  );
}

function terminalRows(
  interactions: readonly ChessPuzzleInteractionRow[]
): ChessPuzzleInteractionRow[] {
  return interactions.filter(
    (r) => isTerminalKind(r.kind) && r.ratingBefore > 0 && r.ratingAfter > 0
  );
}

function deriveBestStreak(
  interactions: readonly ChessPuzzleInteractionRow[]
): number {
  const sorted = [...interactions]
    .filter((r) => isTerminalKind(r.kind))
    .sort((a, b) => a.at.localeCompare(b.at));
  let best = 0;
  let current = 0;
  for (const row of sorted) {
    if (row.kind === CHESS_PUZZLE_INTERACTION_KIND.solved) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function deriveEloSeries(
  terminals: readonly ChessPuzzleInteractionRow[]
): number[] {
  const sorted = [...terminals].sort((a, b) => a.at.localeCompare(b.at));
  if (sorted.length === 0) return [];
  const first = sorted[0];
  if (first === undefined) return [];
  const series = [first.ratingBefore];
  for (const row of sorted) {
    series.push(row.ratingAfter);
  }
  return series;
}

export function deriveChessPuzzleStats(args: {
  interactions: readonly ChessPuzzleInteractionRow[];
  profileRating: number;
}): ChessPuzzleStats {
  const terminals = terminalRows(args.interactions);
  const totalPlayed = terminals.length;
  const totalSolved = terminals.filter(
    (r) => r.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
  ).length;
  const accuracy =
    totalPlayed > 0 ? Math.round((totalSolved / totalPlayed) * 100) : 0;
  const latest = terminals.reduce<ChessPuzzleInteractionRow | null>(
    (best, row) => {
      if (best === null) return row;
      return row.at.localeCompare(best.at) > 0 ? row : best;
    },
    null
  );
  const currentElo =
    latest !== null
      ? latest.ratingAfter
      : args.profileRating > 0
        ? args.profileRating
        : 1200;

  return {
    currentElo,
    totalPlayed,
    totalSolved,
    accuracy,
    currentStreak: deriveCurrentStreak(args.interactions),
    bestStreak: deriveBestStreak(args.interactions),
    eloSeries: deriveEloSeries(terminals),
  };
}

export function deriveChessPuzzleGameLog(
  interactions: readonly ChessPuzzleInteractionRow[]
): ChessPuzzleGameLogEntry[] {
  return terminalRows(interactions)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((row) => ({
      puzzleId: row.puzzleId,
      puzzleRating: row.puzzleRating,
      outcome:
        row.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
          ? 'solved'
          : 'abandoned',
      ratingBefore: row.ratingBefore,
      ratingAfter: row.ratingAfter,
      delta: row.ratingAfter - row.ratingBefore,
      at: row.at,
    }));
}
