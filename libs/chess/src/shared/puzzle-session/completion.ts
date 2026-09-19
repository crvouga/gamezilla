import {
  deriveCurrentStreak,
  playOutcome,
  sliceCurrentPlay,
} from '../chess/chess-puzzle-derive';
import type {
  ChessPuzzleInteractionRow,
  ChessPuzzleOutcomeKind,
} from '../chess/chess-puzzle-interaction-entities';
import { projectPuzzleEloFromInteractions } from '../chess/chess-puzzle-rating';

export type PuzzleCompletionOutcome = ChessPuzzleOutcomeKind;

export type PuzzleCompletion = {
  readonly outcome: PuzzleCompletionOutcome;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly streak: number;
  readonly puzzleRating: number;
};

function interactionKey(row: ChessPuzzleInteractionRow): string {
  return `${row.puzzleId}|${row.kind}|${row.at}|${row.solveIdx}`;
}

/** Merge per-puzzle rows into all-history so projection sees the open play. */
function mergeInteractionHistory(
  all: readonly ChessPuzzleInteractionRow[],
  extra: readonly ChessPuzzleInteractionRow[]
): ChessPuzzleInteractionRow[] {
  const keys = new Set(all.map(interactionKey));
  const out = [...all];
  for (const row of extra) {
    const key = interactionKey(row);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Completion summary for the current play of `puzzleId`, or null while the
 * play has no outcome yet. It always reports the play's first (rated)
 * outcome — a retry solved after a fail still reads as failed. Elo
 * before/after come from the formula projection over attempt facts.
 */
export function derivePuzzleCompletion(args: {
  interactions: readonly ChessPuzzleInteractionRow[];
  puzzleId: string;
  allInteractions: readonly ChessPuzzleInteractionRow[];
}): PuzzleCompletion | null {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const terminal = playOutcome(play);
  if (terminal === null) return null;

  const history = mergeInteractionHistory(
    args.allInteractions,
    args.interactions
  );
  const projected = projectPuzzleEloFromInteractions(history);
  const entry =
    projected.entries.find(
      (e) => e.puzzleId === args.puzzleId && e.at === terminal.at
    ) ??
    [...projected.entries].reverse().find((e) => e.puzzleId === args.puzzleId);
  if (entry === undefined) return null;

  return {
    outcome: entry.outcome,
    ratingBefore: entry.ratingBefore,
    ratingAfter: entry.ratingAfter,
    delta: entry.delta,
    streak: deriveCurrentStreak(history),
    puzzleRating: entry.puzzleRating,
  };
}
