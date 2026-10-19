/**
 * Moving along a puzzle's line: a solve index counts the line's actions
 * played (`1` is the position after the opponent's setup move).
 */

/**
 * Rewind one ply along the solution line (player or opponent).
 * Returns `null` at the post-opening start (`solveIdx <= 1`).
 */
export function prevSolveIdx(solveIdx: number): number | null {
  if (solveIdx <= 1) return null;
  return solveIdx - 1;
}

/**
 * Advance one ply toward `furthestSolveIdx` (never past unattempted moves).
 */
export function nextForwardSolveIdx(args: {
  solveIdx: number;
  furthestSolveIdx: number;
  tokensLength: number;
}): number | null {
  const { solveIdx, furthestSolveIdx, tokensLength } = args;
  if (solveIdx >= furthestSolveIdx) return null;
  const next = solveIdx + 1;
  if (next > tokensLength) return null;
  return Math.min(next, furthestSolveIdx);
}

/**
 * Absolute seek target for move-list taps. Allowed range is
 * `[1, furthestSolveIdx]` (post-opening through furthest attempted).
 * Returns `null` when the target is out of range or already current.
 */
export function resolveSeekSolveIdx(args: {
  solveIdx: number;
  furthestSolveIdx: number;
  targetSolveIdx: number;
}): number | null {
  const { solveIdx, furthestSolveIdx, targetSolveIdx } = args;
  if (targetSolveIdx < 1 || targetSolveIdx > furthestSolveIdx) return null;
  if (targetSolveIdx === solveIdx) return null;
  return targetSolveIdx;
}

/** A stored line's actions: its space-separated words, blanks dropped. */
export function lineActions(line: string): readonly string[] {
  return line
    .trim()
    .split(/\s+/)
    .filter((action) => action.length > 0);
}

/** How many actions a stored line has. */
export function lineLength(line: string): number {
  return lineActions(line).length;
}
