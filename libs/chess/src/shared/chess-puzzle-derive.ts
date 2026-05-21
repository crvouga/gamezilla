import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleInteractionRow,
} from './chess-puzzle-interaction-entities';
import type { PuzzleRatingScore } from './chess-puzzle-rating';

function isTerminalKind(kind: ChessPuzzleInteractionKind): boolean {
  return (
    kind === CHESS_PUZZLE_INTERACTION_KIND.solved ||
    kind === CHESS_PUZZLE_INTERACTION_KIND.abandoned
  );
}

/** Rows for the current open play of `puzzleId` (since last `started`). */
export function sliceCurrentPlay(
  interactions: readonly ChessPuzzleInteractionRow[],
  puzzleId: string
): readonly ChessPuzzleInteractionRow[] {
  const forPuzzle = interactions.filter((r) => r.puzzleId === puzzleId);
  let startIdx = -1;
  for (let i = forPuzzle.length - 1; i >= 0; i -= 1) {
    const row = forPuzzle[i];
    if (
      row !== undefined &&
      row.kind === CHESS_PUZZLE_INTERACTION_KIND.started
    ) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return [];
  return forPuzzle.slice(startIdx);
}

/** Hint and wrong-move counts for the currently open play of a puzzle. */
export function deriveCurrentPlayCounts(
  interactions: readonly ChessPuzzleInteractionRow[],
  puzzleId: string
): { hintsUsed: number; wrongMoves: number } {
  const play = sliceCurrentPlay(interactions, puzzleId);
  let hintsUsed = 0;
  let wrongMoves = 0;
  for (const row of play) {
    if (row.kind === CHESS_PUZZLE_INTERACTION_KIND.usedHint) hintsUsed += 1;
    if (
      row.kind === CHESS_PUZZLE_INTERACTION_KIND.moved &&
      row.correct === false
    ) {
      wrongMoves += 1;
    }
  }
  return { hintsUsed, wrongMoves };
}

/**
 * Outcome score for Glicko: 1 = clean solve, 0.5 = solved with help,
 * 0 = abandoned or failed without solve.
 */
export function deriveOutcomeScore(
  closed: readonly ChessPuzzleInteractionRow[]
): PuzzleRatingScore {
  const terminal = closed.findLast((r) => isTerminalKind(r.kind));
  if (terminal === undefined) return 0;
  if (terminal.kind === CHESS_PUZZLE_INTERACTION_KIND.abandoned) return 0;

  const { hintsUsed, wrongMoves } = deriveCurrentPlayCounts(
    closed,
    terminal.puzzleId
  );
  if (hintsUsed === 0 && wrongMoves === 0) return 1;
  return 0.5;
}

/** Most-recent N distinct puzzleIds the user has started (for next-puzzle exclusion). */
export function deriveRecentlyAttemptedPuzzleIds(
  interactions: readonly ChessPuzzleInteractionRow[],
  limit: number
): readonly string[] {
  const sorted = [...interactions].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of sorted) {
    if (row.kind !== CHESS_PUZZLE_INTERACTION_KIND.started) continue;
    if (seen.has(row.puzzleId)) continue;
    seen.add(row.puzzleId);
    out.push(row.puzzleId);
    if (out.length >= limit) break;
  }
  return out;
}

/** Consecutive solved plays (most recent terminal events). */
export function deriveCurrentStreak(
  interactions: readonly ChessPuzzleInteractionRow[]
): number {
  const sorted = [...interactions].sort((a, b) => b.at.localeCompare(a.at));
  let streak = 0;
  for (const row of sorted) {
    if (!isTerminalKind(row.kind)) continue;
    if (row.kind === CHESS_PUZZLE_INTERACTION_KIND.solved) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Whether the current play of `puzzleId` already has a terminal interaction. */
export function isPlayClosed(
  interactions: readonly ChessPuzzleInteractionRow[],
  puzzleId: string
): boolean {
  const play = sliceCurrentPlay(interactions, puzzleId);
  return play.some((r) => isTerminalKind(r.kind));
}
