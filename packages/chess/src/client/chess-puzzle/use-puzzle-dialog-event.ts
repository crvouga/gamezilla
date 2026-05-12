/**
 * Derives the granular {@link DialogEvent} consumed by
 * {@link getPuzzlePlayDialog} from the puzzle FSM signals.
 *
 * The server-authoritative FSM in `chess-puzzle-play.ts` only exposes
 * `idle | solving | wrong | solved | invalid`. The host playing a *correct*
 * intermediate move stays in `solving` (the opponent's canned reply auto-
 * applies and `solveIdx` advances by 2). That means "good job, keep going"
 * vs. "find the first move" vs. "try again after a miss" cannot be told apart
 * from `status` alone.
 *
 * We reconstruct the missing transitions client-side:
 * - `status === 'loading'` → `null` (coach stays silent; no `'loading'`
 *   variant exists on `DialogEvent`).
 * - `solveIdx <= 1` and `status === 'solving'` → host hasn't played yet → `start`.
 * - `status === 'solving'` after `prevStatus === 'wrong'` → `retry`.
 * - `status === 'solving'` otherwise (host has at least one accepted move) → `progress`.
 *
 * The `prevStatus` ref updates in a layout-effect so the same render sees the
 * pre-transition value; otherwise React's render-commit cycle would mask the
 * `wrong -> solving` transition.
 */
import { useEffect, useRef } from 'react';
import type { SolveStatus } from './use-chess-puzzle-solver';
import type { DialogEvent } from './chess-puzzle-play-dialog';

function deriveDialogEvent(args: {
  status: SolveStatus;
  solveIdx: number;
  prevStatus: SolveStatus | null;
}): DialogEvent | null {
  const { status, solveIdx, prevStatus } = args;
  if (status === 'loading') return null;
  if (status === 'invalid') return 'invalid';
  if (status === 'wrong') return 'wrong';
  if (status === 'solved') return 'solved';
  if (prevStatus === 'wrong') return 'retry';
  if (solveIdx <= 1) return 'start';
  return 'progress';
}

export function usePuzzleDialogEvent(args: {
  status: SolveStatus;
  solveIdx: number;
}): DialogEvent | null {
  const prevStatusRef = useRef<SolveStatus | null>(null);
  const event = deriveDialogEvent({
    status: args.status,
    solveIdx: args.solveIdx,
    prevStatus: prevStatusRef.current,
  });
  useEffect(() => {
    prevStatusRef.current = args.status;
  }, [args.status]);
  return event;
}
