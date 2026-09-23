/**
 * Pure projections for the puzzle stopwatch: elapsed time from the room's
 * server-stamped start/end anchors, and the `m:ss` label. No clock reads here —
 * callers pass `nowMs` from the injected `Clock`.
 */

import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess/chess-puzzle-play';

/** The clock ticks (and shows) while the attempt is live. */
export function isPuzzleClockRunning(
  status: ChessPuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.wrong
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
