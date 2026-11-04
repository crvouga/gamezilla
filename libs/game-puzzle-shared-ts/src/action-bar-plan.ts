/**
 * Pure mode → slot plan for the puzzle's action row (no UI imports). Moving
 * through the line is not here: its step and jump controls flank the move
 * list, so the row holds only what is done about the puzzle itself.
 */

import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';

export type ActionBarSolveStatus = 'loading' | PuzzlePlayStatus;
export type ActionBarHintStage = 'none' | 'highlight' | 'solution';

export type PuzzleActionBarPlanInput = {
  status: ActionBarSolveStatus;
  hintStage: ActionBarHintStage;
  /** Looking back at an earlier move: no hint until back at the latest. */
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
      id: 'solution';
      type: 'action';
      disabled: boolean;
    }
  | {
      /** Drawn apart from the rest: leaving the puzzle, not help with it. */
      id: 'skip';
      type: 'action';
      disabled: boolean;
    }
  | {
      id: 'retry';
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
  return [hintSlot(p), skipSlot(p.status === 'loading')];
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

/** Solved, skipped or the solution shown: move on, or try it again. */
function overSlots(): PuzzleActionBarSlot[] {
  return [
    { id: 'next', type: 'button', intent: 'primary' },
    { id: 'retry', type: 'action', disabled: false },
  ];
}

/** Mode-specific slot plan. Exported for unit tests. */
export function buildPuzzleActionBarPlan(
  p: PuzzleActionBarPlanInput
): PuzzleActionBarSlot[] {
  if (p.status === 'wrong') return wrongSlots();
  if (
    p.status === 'revealed' ||
    p.status === 'solved' ||
    p.status === 'skipped'
  )
    return overSlots();
  return solvingSlots(p);
}
