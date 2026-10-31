/**
 * Pure mode → slot plan for the puzzle bottom bar (no UI imports).
 */

import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';

export type ActionBarSolveStatus = 'loading' | PuzzlePlayStatus;
export type ActionBarHintStage = 'none' | 'highlight' | 'solution';

export type PuzzleActionBarPlanInput = {
  status: ActionBarSolveStatus;
  hintStage: ActionBarHintStage;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type PuzzleActionBarSlot =
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
      intent: 'primary';
    };

/**
 * One escalating button, so "Solution" is never offered twice at once:
 * Hint (highlight the squares) → Solution (full arrow) → Solution (§6, plays
 * the rest of the line out, then review).
 */
function hintSlot(
  p: PuzzleActionBarPlanInput
): Extract<PuzzleActionBarSlot, { id: 'hint' }> {
  const baseDisabled = p.status !== 'solving' || p.canGoForward;
  return {
    id: 'hint',
    type: 'action',
    hintLabel: p.hintStage === 'none' ? 'hint' : 'solution',
    disabled: baseDisabled,
  };
}

function skipSlot(disabled: boolean): PuzzleActionBarSlot {
  return { id: 'skip', type: 'action', disabled };
}

function solvingSlots(p: PuzzleActionBarPlanInput): PuzzleActionBarSlot[] {
  const navDisabled = p.status === 'loading';
  return [
    hintSlot(p),
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

function wrongSlots(): PuzzleActionBarSlot[] {
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

function solvedSlots(p: PuzzleActionBarPlanInput): PuzzleActionBarSlot[] {
  return [
    { id: 'back', type: 'action', disabled: !p.canGoBack },
    { id: 'forward', type: 'action', disabled: !p.canGoForward },
    { id: 'next', type: 'button', intent: 'primary' },
    { id: 'retry', type: 'action', disabled: false },
  ];
}

/** Review after "Show solution": scrub the whole line, then move on. */
function revealedSlots(p: PuzzleActionBarPlanInput): PuzzleActionBarSlot[] {
  return [
    { id: 'back', type: 'action', disabled: !p.canGoBack },
    { id: 'forward', type: 'action', disabled: !p.canGoForward },
    { id: 'next', type: 'button', intent: 'primary' },
    { id: 'retry', type: 'action', disabled: false },
  ];
}

/** Mode-specific slot plan. Exported for unit tests. */
export function buildPuzzleActionBarPlan(
  p: PuzzleActionBarPlanInput
): PuzzleActionBarSlot[] {
  if (p.status === 'wrong') return wrongSlots();
  if (p.status === 'revealed') return revealedSlots(p);
  if (p.status === 'solved' || p.status === 'skipped') return solvedSlots(p);
  return solvingSlots(p);
}
