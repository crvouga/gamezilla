import { describe, expect, test } from 'bun:test';

import {
  buildChessPuzzleActionBarPlan,
  type ChessPuzzleActionBarPlanInput,
} from '@libs/chess/public/puzzle-session';

function input(
  partial: Partial<ChessPuzzleActionBarPlanInput>
): ChessPuzzleActionBarPlanInput {
  return {
    status: 'solving',
    hintStage: 'none',
    canGoBack: false,
    canGoForward: false,
    ...partial,
  };
}

function ids(
  slots: ReturnType<typeof buildChessPuzzleActionBarPlan>
): string[] {
  return slots.map((s) => s.id);
}

describe('buildChessPuzzleActionBarPlan', () => {
  // One escalating button: Hint → Solution (arrow) → Solution (§6 line).
  test('solving never offers Solution twice; the hint button escalates', () => {
    const stages = ['none', 'highlight', 'solution'] as const;
    const labels = stages.map((hintStage) => {
      const slots = buildChessPuzzleActionBarPlan(
        input({ status: 'solving', hintStage })
      );
      expect(slots.some((s) => s.id === 'solution')).toBe(false);
      const hint = slots[0];
      expect(hint?.id === 'hint' && hint.disabled).toBe(false);
      return hint?.id === 'hint' ? hint.hintLabel : null;
    });
    expect(labels).toEqual(['hint', 'solution', 'solution']);
    const loading = buildChessPuzzleActionBarPlan(input({ status: 'loading' }));
    const idle = loading[0];
    expect(idle?.id === 'hint' && idle.disabled).toBe(true);
  });

  test('revealed review: back + forward + next button + retry', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'revealed', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['back', 'forward', 'next', 'retry']);
  });

  test('solving at frontier: hint + back + disabled forward', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward', 'skip']);
    const back = slots.find((s) => s.id === 'back');
    const forward = slots.find((s) => s.id === 'forward');
    expect(back?.type === 'action' && back.disabled).toBe(false);
    expect(forward?.type === 'action' && forward.disabled).toBe(true);
  });

  test('solving after back: hint + back + forward', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: true })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward', 'skip']);
    const forward = slots.find((s) => s.id === 'forward');
    expect(forward?.type === 'action' && forward.disabled).toBe(false);
  });

  test('loading: hint + back + forward all disabled', () => {
    const slots = buildChessPuzzleActionBarPlan(
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
    const slots = buildChessPuzzleActionBarPlan(input({ status: 'wrong' }));
    expect(ids(slots)).toEqual(['solution', 'retry', 'skip']);
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry).toEqual({ id: 'retry', type: 'button', intent: 'danger' });
    const skip = slots.find((s) => s.id === 'skip');
    expect(skip?.type === 'action' && skip.disabled).toBe(false);
  });

  test('solved: back + success next button + retry action', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'solved', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['back', 'next', 'retry']);
    const next = slots.find((s) => s.id === 'next');
    expect(next).toEqual({ id: 'next', type: 'button', intent: 'success' });
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry?.type).toBe('action');
  });
});
