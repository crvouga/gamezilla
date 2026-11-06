import { describe, expect, test } from 'bun:test';
import type { PuzzleActionBarPlanInput } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';

function input(
  partial: Partial<PuzzleActionBarPlanInput>
): PuzzleActionBarPlanInput {
  return {
    status: 'solving',
    hintStage: 'none',
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

  test('revealed, solved or skipped: primary next button + retry action', () => {
    for (const status of ['revealed', 'solved', 'skipped'] as const) {
      const slots = buildPuzzleActionBarPlan(input({ status }));
      expect(ids(slots)).toEqual(['next', 'retry']);
      expect(slots[0]).toEqual({
        id: 'next',
        type: 'button',
        intent: 'primary',
      });
      expect(slots[1]?.type).toBe('action');
    }
  });

  // regression: puzzle-move-review-twice
  // Moving through the line belongs to the move list's own controls.
  test('solving: hint and skip only, the hint held back while looking back', () => {
    const latest = buildPuzzleActionBarPlan(input({ status: 'solving' }));
    expect(ids(latest)).toEqual(['hint', 'skip']);
    expect(latest.map((s) => s.type === 'action' && s.disabled)).toEqual([
      false,
      false,
    ]);
    const earlier = buildPuzzleActionBarPlan(
      input({ status: 'solving', canGoForward: true })
    );
    expect(ids(earlier)).toEqual(['hint', 'skip']);
    expect(earlier[0]?.id === 'hint' && earlier[0].disabled).toBe(true);
  });

  test('loading: hint and skip both disabled', () => {
    const slots = buildPuzzleActionBarPlan(input({ status: 'loading' }));
    expect(ids(slots)).toEqual(['hint', 'skip']);
    expect(slots.every((s) => s.type === 'action' && s.disabled)).toBe(true);
  });

  test('wrong: solution + danger retry button + skip action', () => {
    const slots = buildPuzzleActionBarPlan(input({ status: 'wrong' }));
    expect(ids(slots)).toEqual(['solution', 'retry', 'skip']);
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry).toEqual({ id: 'retry', type: 'button', intent: 'danger' });
    const skip = slots.find((s) => s.id === 'skip');
    expect(skip?.type === 'action' && skip.disabled).toBe(false);
  });
});
