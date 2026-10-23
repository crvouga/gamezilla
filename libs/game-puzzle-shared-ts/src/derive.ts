import { compareCodeUnit } from './code-unit-compare';
import type {
  PuzzleInteractionRow,
  PuzzleOutcomeKind,
} from './interaction-entities';
import { isOutcomeKind, PUZZLE_INTERACTION_KIND } from './interaction-entities';

/** Rows for the current open play of `puzzleId` (since last `started`). */
export function sliceCurrentPlay(
  interactions: readonly PuzzleInteractionRow[],
  puzzleId: string
): readonly PuzzleInteractionRow[] {
  const forPuzzle = interactions.filter((r) => r.puzzleId === puzzleId);
  let startIdx = -1;
  for (let i = forPuzzle.length - 1; i >= 0; i -= 1) {
    const row = forPuzzle[i];
    if (row !== undefined && row.kind === PUZZLE_INTERACTION_KIND.started) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return [];
  return forPuzzle.slice(startIdx);
}

/** Hint and wrong-move counts for the currently open play of a puzzle. */
export function deriveCurrentPlayCounts(
  interactions: readonly PuzzleInteractionRow[],
  puzzleId: string
): { hintsUsed: number; wrongMoves: number } {
  const play = sliceCurrentPlay(interactions, puzzleId);
  let hintsUsed = 0;
  let wrongMoves = 0;
  for (const row of play) {
    if (row.kind === PUZZLE_INTERACTION_KIND.usedHint) hintsUsed += 1;
    if (row.kind === PUZZLE_INTERACTION_KIND.moved && row.correct === false) {
      wrongMoves += 1;
    }
  }
  return { hintsUsed, wrongMoves };
}

/** The play's rated outcome row: its first solved / failed / abandoned row. */
export function playOutcome(
  play: readonly PuzzleInteractionRow[]
): (PuzzleInteractionRow & { readonly kind: PuzzleOutcomeKind }) | null {
  return (
    play.find(
      (
        r
      ): r is PuzzleInteractionRow & {
        readonly kind: PuzzleOutcomeKind;
      } => isOutcomeKind(r.kind)
    ) ?? null
  );
}

/**
 * Rating score of a play from its first outcome (§5): 1 = clean solve,
 * 0.5 = hinted solve or wrong move, 0 = solution shown or abandoned.
 * Rows after the outcome never count.
 */
export function deriveOutcomeScore(
  play: readonly PuzzleInteractionRow[]
): 0 | 0.5 | 1 {
  const outcomeAt = play.findIndex((r) => isOutcomeKind(r.kind));
  const outcome = play[outcomeAt];
  if (outcome === undefined) return 0;
  const before = play.slice(0, outcomeAt + 1);
  const { hintsUsed, wrongMoves } = deriveCurrentPlayCounts(
    before,
    outcome.puzzleId
  );
  if (outcome.kind === PUZZLE_INTERACTION_KIND.solved) {
    return hintsUsed === 0 && wrongMoves === 0 ? 1 : 0.5;
  }
  if (outcome.kind === PUZZLE_INTERACTION_KIND.failed && wrongMoves > 0) {
    return 0.5;
  }
  return 0;
}

/** Most-recent N distinct puzzleIds the user has started (for next-puzzle exclusion). */
export function deriveRecentlyAttemptedPuzzleIds(
  interactions: readonly PuzzleInteractionRow[],
  limit: number
): readonly string[] {
  const sorted = [...interactions].sort((a, b) => compareCodeUnit(b.at, a.at));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of sorted) {
    if (row.kind !== PUZZLE_INTERACTION_KIND.started) continue;
    if (seen.has(row.puzzleId)) continue;
    seen.add(row.puzzleId);
    out.push(row.puzzleId);
    if (out.length >= limit) break;
  }
  return out;
}

/** Consecutive solved plays (most recent outcomes). */
export function deriveCurrentStreak(
  interactions: readonly PuzzleInteractionRow[]
): number {
  const sorted = [...interactions].sort((a, b) => compareCodeUnit(b.at, a.at));
  let streak = 0;
  for (const row of sorted) {
    if (!isOutcomeKind(row.kind)) continue;
    if (row.kind === PUZZLE_INTERACTION_KIND.solved) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Whether the current play of `puzzleId` already has its rated outcome. */
export function hasPlayOutcome(
  interactions: readonly PuzzleInteractionRow[],
  puzzleId: string
): boolean {
  return playOutcome(sliceCurrentPlay(interactions, puzzleId)) !== null;
}

/**
 * Whether `puzzleId` has a play that started and has no outcome yet — the
 * pending attempt a reload / return restores (no new `started` row).
 */
export function hasPendingPlay(
  interactions: readonly PuzzleInteractionRow[],
  puzzleId: string
): boolean {
  const play = sliceCurrentPlay(interactions, puzzleId);
  return play.length > 0 && playOutcome(play) === null;
}
