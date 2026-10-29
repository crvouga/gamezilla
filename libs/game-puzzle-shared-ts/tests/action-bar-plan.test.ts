import { describe, expect, test } from 'bun:test';
import type { PuzzleActionBarPlanInput } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';

function input(
  partial: Partial<PuzzleActionBarPlanInput>
): PuzzleActionBarPlanInput {
  return {
    status: 'solving',
    hintStage: 'none',
    canGoBack: false,
    canGoForward: false,
    ...partial,
  };
}

function ids(slots: ReturnType<typeof buildPuzzleActionBarPlan>): string[] {
  return slots.map((s) => s.id);
}

describe('buildPuzzleActionBarPlan', () => {
  // One escalating button: Hint → Solution (arrow) → Solution (§6 line).
  test('solving never offers Solution twice; the hint button escalates', () => {
    const stages = ['none', 'highlight', 'solution'] as const;
    const labels = stages.map((hintStage) => {
      const slots = buildPuzzleActionBarPlan(
        input({ status: 'solving', hintStage })
      );
      expect(slots.some((s) => s.id === 'solution')).toBe(false);
      const hint = slots[0];
      expect(hint?.id === 'hint' && hint.disabled).toBe(false);
      return hint?.id === 'hint' ? hint.hintLabel : null;
    });
    expect(labels).toEqual(['hint', 'solution', 'solution']);
    const loading = buildPuzzleActionBarPlan(input({ status: 'loading' }));
    const idle = loading[0];
    expect(idle?.id === 'hint' && idle.disabled).toBe(true);
  });

  test('revealed review: back + forward + next button + retry', () => {
    const slots = buildPuzzleActionBarPlan(
      input({ status: 'revealed', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['back', 'forward', 'next', 'retry']);
  });

  test('solving at frontier: hint + back + disabled forward', () => {
    const slots = buildPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward', 'skip']);
    const back = slots.find((s) => s.id === 'back');
    const forward = slots.find((s) => s.id === 'forward');
    expect(back?.type === 'action' && back.disabled).toBe(false);
    expect(forward?.type === 'action' && forward.disabled).toBe(true);
  });

  test('solving after back: hint + back + forward', () => {
    const slots = buildPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: true })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward', 'skip']);
    expect(slots.find((s) => s.id === 'hint')?.disabled).toBe(true);
    const forward = slots.find((s) => s.id === 'forward');
    expect(forward?.type === 'action' && forward.disabled).toBe(false);
  });

  test('loading: hint + back + forward all disabled', () => {
    const slots = buildPuzzleActionBarPlan(
      input({ status: 'loading', canGoBack: true, canGoForward: true })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward', 'skip']);
    const hint = slots[0];
    const back = slots[1];
    const forward = slots[2];
    expect(hint?.id === 'hint' && hint.disabled).toBe(true);
    expect(back?.id === 'back' && back.disabled).toBe(true);
    expect(forward?.id === 'forward' && forward.disabled).toBe(true);
  });

  test('wrong: solution + danger retry button + skip action', () => {
    const slots = buildPuzzleActionBarPlan(input({ status: 'wrong' }));
    expect(ids(slots)).toEqual(['solution', 'retry', 'skip']);
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry).toEqual({ id: 'retry', type: 'button', intent: 'danger' });
    const skip = slots.find((s) => s.id === 'skip');
    expect(skip?.type === 'action' && skip.disabled).toBe(false);
  });

  test('solved: position navigation + primary next button + retry action', () => {
    const slots = buildPuzzleActionBarPlan(
      input({ status: 'solved', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['back', 'forward', 'next', 'retry']);
    const next = slots.find((s) => s.id === 'next');
    expect(next).toEqual({ id: 'next', type: 'button', intent: 'primary' });
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry?.type).toBe('action');
  });
});
