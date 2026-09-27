/**
 * Pure mode → slot plan for the puzzle bottom bar (no UI imports).
 */

import type { ChessPuzzlePlayStatus } from '../chess/chess-puzzle-play';

export type ActionBarSolveStatus = 'loading' | ChessPuzzlePlayStatus;
export type ActionBarHintStage = 'none' | 'highlight' | 'solution';

export type ChessPuzzleActionBarPlanInput = {
  status: ActionBarSolveStatus;
  hintStage: ActionBarHintStage;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type ChessPuzzleActionBarSlot =
  | {
      id: 'hint';
      type: 'action';
      hintLabel: 'hint' | 'solution';
      disabled: boolean;
    }
  | {
      id: 'solution' | 'skip';
      type: 'action';
      disabled: boolean;
    }
  | {
      id: 'back' | 'forward' | 'next' | 'retry';
      type: 'action';
      disabled: boolean;
    }
  | {
      id: 'retry';
      type: 'button';
      intent: 'danger';
    }
  | {
      id: 'next';
      type: 'button';
      intent: 'success';
    };

/**
 * One escalating button, so "Solution" is never offered twice at once:
 * Hint (highlight the squares) → Solution (full arrow) → Solution (§6, plays
 * the rest of the line out, then review).
 */
function hintSlot(
  status: ActionBarSolveStatus,
  hintStage: ActionBarHintStage
): Extract<ChessPuzzleActionBarSlot, { id: 'hint' }> {
  const baseDisabled = status !== 'solving';
  return {
    id: 'hint',
    type: 'action',
    hintLabel: hintStage === 'none' ? 'hint' : 'solution',
    disabled: baseDisabled,
  };
}

function skipSlot(disabled: boolean): ChessPuzzleActionBarSlot {
  return { id: 'skip', type: 'action', disabled };
}

function solvingSlots(
  p: ChessPuzzleActionBarPlanInput
): ChessPuzzleActionBarSlot[] {
  const navDisabled = p.status === 'loading';
  return [
    hintSlot(p.status, p.hintStage),
    {
      id: 'back',
      type: 'action',
      disabled: navDisabled || !p.canGoBack,
    },
    {
      id: 'forward',
      type: 'action',
      disabled: navDisabled || !p.canGoForward,
    },
    skipSlot(navDisabled),
  ];
}

function wrongSlots(): ChessPuzzleActionBarSlot[] {
  return [
    { id: 'solution', type: 'action', disabled: false },
    {
      id: 'retry',
      type: 'button',
      intent: 'danger',
    },
    skipSlot(false),
  ];
}

function solvedSlots(
  p: ChessPuzzleActionBarPlanInput
): ChessPuzzleActionBarSlot[] {
  return [
    { id: 'back', type: 'action', disabled: !p.canGoBack },
    { id: 'next', type: 'button', intent: 'success' },
    { id: 'retry', type: 'action', disabled: false },
  ];
}

/** Review after "Show solution": scrub the whole line, then move on. */
function revealedSlots(
  p: ChessPuzzleActionBarPlanInput
): ChessPuzzleActionBarSlot[] {
  return [
    { id: 'back', type: 'action', disabled: !p.canGoBack },
    { id: 'forward', type: 'action', disabled: !p.canGoForward },
    { id: 'next', type: 'button', intent: 'success' },
    { id: 'retry', type: 'action', disabled: false },
  ];
}

/** Mode-specific slot plan. Exported for unit tests. */
export function buildChessPuzzleActionBarPlan(
  p: ChessPuzzleActionBarPlanInput
): ChessPuzzleActionBarSlot[] {
  if (p.status === 'wrong') return wrongSlots();
  if (p.status === 'revealed') return revealedSlots(p);
  if (p.status === 'solved' || p.status === 'skipped') return solvedSlots(p);
  return solvingSlots(p);
}
