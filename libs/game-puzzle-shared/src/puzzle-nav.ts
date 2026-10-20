import type { PuzzlePlayStatus } from './play-attr';
import { PUZZLE_PLAY_STATUS } from './play-attr';
import { lineLength, nextForwardSolveIdx, prevSolveIdx } from './step';

export type PuzzleNavModel = {
  atFrontier: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

/** Pure nav affordances from room attrs (ply-by-ply step back/forward). */
export function puzzleNavFromState(args: {
  status: PuzzlePlayStatus | 'loading';
  solveIdx: number;
  furthestSolveIdx: number;
  moves: string;
  firstSolveIdx: 0 | 1;
}): PuzzleNavModel {
  const { status, solveIdx, furthestSolveIdx, moves } = args;
  const scrubbing =
    status === PUZZLE_PLAY_STATUS.solving ||
    status === PUZZLE_PLAY_STATUS.solved ||
    status === PUZZLE_PLAY_STATUS.revealed;
  if (!scrubbing) {
    return { atFrontier: true, canGoBack: false, canGoForward: false };
  }
  const tokensLength = lineLength(moves);
  const canGoBack = prevSolveIdx(solveIdx, args.firstSolveIdx) !== null;
  const canGoForward =
    nextForwardSolveIdx({
      solveIdx,
      furthestSolveIdx,
      tokensLength,
    }) !== null;
  return {
    atFrontier: solveIdx >= furthestSolveIdx,
    canGoBack,
    canGoForward,
  };
}

/**
 * §7 scrubbing intents. `start` / `end` jump to the ends of the reached line;
 * `back` / `forward` move one ply.
 */
export const PUZZLE_NAV_INTENT = {
  start: 'start',
  back: 'back',
  forward: 'forward',
  end: 'end',
} as const;

export type PuzzleNavIntent =
  (typeof PUZZLE_NAV_INTENT)[keyof typeof PUZZLE_NAV_INTENT];

/**
 * §7 keyboard map: the arrows step one ply, Home / End jump to the ends.
 * Pure so the keymap is assertable without a DOM.
 */
export function puzzleNavIntentFromKey(key: string): PuzzleNavIntent | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return PUZZLE_NAV_INTENT.back;
    case 'ArrowRight':
    case 'ArrowDown':
      return PUZZLE_NAV_INTENT.forward;
    case 'Home':
      return PUZZLE_NAV_INTENT.start;
    case 'End':
      return PUZZLE_NAV_INTENT.end;
    default:
      return null;
  }
}

/** Below this the pointer travel is a tap or a vertical scroll, not a swipe. */
export const PUZZLE_SWIPE_THRESHOLD_PX = 24;

/**
 * §7 swipe map. Dragging left pulls the next ply in from the right (forward);
 * dragging right pulls the previous one back. A mostly-vertical drag is a
 * scroll and never scrubs.
 */
export function puzzleNavIntentFromSwipe(args: {
  dx: number;
  dy: number;
  thresholdPx?: number;
}): PuzzleNavIntent | null {
  const threshold = args.thresholdPx ?? PUZZLE_SWIPE_THRESHOLD_PX;
  if (!Number.isFinite(args.dx) || !Number.isFinite(args.dy)) return null;
  if (Math.abs(args.dx) < threshold) return null;
  if (Math.abs(args.dx) <= Math.abs(args.dy)) return null;
  return args.dx < 0 ? PUZZLE_NAV_INTENT.forward : PUZZLE_NAV_INTENT.back;
}

/**
 * Absolute seek target for an intent inside the reached line
 * `[firstSolveIdx, furthestSolveIdx]`. `null` = the intent is a
 * no-op (already at that end, or nothing reached yet).
 */
export function resolvePuzzleNavTarget(args: {
  intent: PuzzleNavIntent;
  solveIdx: number;
  furthestSolveIdx: number;
  firstSolveIdx: 0 | 1;
}): number | null {
  const { intent, solveIdx, furthestSolveIdx, firstSolveIdx } = args;
  if (furthestSolveIdx < firstSolveIdx) return null;
  const target = navTarget(intent, solveIdx, furthestSolveIdx, firstSolveIdx);
  const clamped = Math.min(Math.max(target, firstSolveIdx), furthestSolveIdx);
  return clamped === solveIdx ? null : clamped;
}

function navTarget(
  intent: PuzzleNavIntent,
  solveIdx: number,
  furthestSolveIdx: number,
  firstSolveIdx: 0 | 1
): number {
  switch (intent) {
    case PUZZLE_NAV_INTENT.start:
      return firstSolveIdx;
    case PUZZLE_NAV_INTENT.end:
      return furthestSolveIdx;
    case PUZZLE_NAV_INTENT.back:
      return solveIdx - 1;
    case PUZZLE_NAV_INTENT.forward:
      return solveIdx + 1;
  }
}

/**
 * §7: "the board animates on single steps, snaps on jumps". One ply either
 * way is a step; a move-list tap or a Home / End jump across more than one
 * ply snaps, because sliding several pieces at once reads as noise.
 */
export function isPuzzleSeekAnimated(
  fromSolveIdx: number,
  toSolveIdx: number
): boolean {
  return Math.abs(toSolveIdx - fromSolveIdx) === 1;
}
