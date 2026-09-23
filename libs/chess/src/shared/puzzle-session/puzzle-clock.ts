/**
 * Pure projections for the puzzle stopwatch. The play screen anchors the
 * attempt locally (this branch has no room start/end stamps) and passes
 * `nowMs` from the injected clock — this module never reads the clock.
 */

import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess/chess-puzzle-play';
import type { SolveStatus } from './solve-status';

/** The clock ticks while the attempt is live (including a wrong-move retry). */
export function isPuzzleClockRunning(status: SolveStatus): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.wrong
  );
}

function isTerminal(status: SolveStatus): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solved ||
    status === CHESS_PUZZLE_PLAY_STATUS.invalid
  );
}

/**
 * Elapsed solve time in ms, or `null` when the attempt never started. Frozen
 * at `endedAtMs` once the attempt is terminal; never negative.
 */
export function puzzleElapsedMs(args: {
  readonly startedAtMs: number | null;
  readonly endedAtMs: number | null;
  readonly nowMs: number;
}): number | null {
  const { startedAtMs, endedAtMs } = args;
  if (startedAtMs === null) return null;
  const end = endedAtMs ?? args.nowMs;
  return Math.max(0, Math.trunc(end - startedAtMs));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `m:ss` (minutes keep counting past 60), e.g. `0:07`, `1:30`, `61:01`. */
export function formatPuzzleClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${pad2(totalSeconds % 60)}`;
}

export type PuzzleClockAnchor = {
  readonly puzzleId: string;
  readonly layoutKey: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number | null;
  readonly status: ChessPuzzlePlayStatus;
};

function freshAnchor(args: {
  readonly puzzleId: string;
  readonly layoutKey: number;
  readonly status: ChessPuzzlePlayStatus;
  readonly nowMs: number;
}): PuzzleClockAnchor {
  return {
    puzzleId: args.puzzleId,
    layoutKey: args.layoutKey,
    startedAtMs: args.nowMs,
    endedAtMs: null,
    status: args.status,
  };
}

/**
 * Next stopwatch anchor for one puzzle attempt.
 *
 * A wrong-move retry bumps `layoutKey` but keeps the same start. Any other
 * layout change while the attempt is live (full retry) starts over. Terminal
 * statuses freeze the elapsed time.
 */
function playStatus(status: SolveStatus): ChessPuzzlePlayStatus | null {
  if (status === 'loading' || status === CHESS_PUZZLE_PLAY_STATUS.idle) {
    return null;
  }
  return status;
}

export function nextPuzzleClockAnchor(args: {
  readonly previous: PuzzleClockAnchor | null;
  readonly puzzleId: string;
  readonly layoutKey: number;
  readonly status: SolveStatus;
  readonly nowMs: number;
}): PuzzleClockAnchor | null {
  const { previous, puzzleId, layoutKey, nowMs } = args;
  const status = playStatus(args.status);
  if (puzzleId.length === 0 || status === null) return null;
  if (!isPuzzleClockRunning(status) && !isTerminal(status)) return null;
  if (previous === null || previous.puzzleId !== puzzleId) {
    return isPuzzleClockRunning(status)
      ? freshAnchor({ puzzleId, layoutKey, status, nowMs })
      : null;
  }
  return advanceAnchor(previous, { layoutKey, status, nowMs });
}

function advanceAnchor(
  previous: PuzzleClockAnchor,
  args: {
    readonly layoutKey: number;
    readonly status: ChessPuzzlePlayStatus;
    readonly nowMs: number;
  }
): PuzzleClockAnchor {
  const { layoutKey, status, nowMs } = args;
  const continueAfterWrong =
    previous.layoutKey !== layoutKey &&
    previous.status === CHESS_PUZZLE_PLAY_STATUS.wrong &&
    status === CHESS_PUZZLE_PLAY_STATUS.solving;
  if (
    previous.layoutKey !== layoutKey &&
    !continueAfterWrong &&
    isPuzzleClockRunning(status)
  ) {
    return freshAnchor({
      puzzleId: previous.puzzleId,
      layoutKey,
      status,
      nowMs,
    });
  }
  if (isTerminal(status) && previous.endedAtMs === null) {
    return { ...previous, layoutKey, endedAtMs: nowMs, status };
  }
  if (isPuzzleClockRunning(status) && previous.endedAtMs !== null) {
    return freshAnchor({
      puzzleId: previous.puzzleId,
      layoutKey,
      status,
      nowMs,
    });
  }
  if (previous.status === status && previous.layoutKey === layoutKey) {
    return previous;
  }
  return { ...previous, layoutKey, status };
}
