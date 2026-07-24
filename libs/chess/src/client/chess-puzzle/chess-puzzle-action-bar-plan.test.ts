import { describe, expect, test } from 'bun:test';

import {
  buildChessPuzzleActionBarPlan,
  type ChessPuzzleActionBarPlanInput,
} from './chess-puzzle-action-bar-plan';

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
  test('solving at frontier: hint + back + disabled forward', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: false })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward']);
    const back = slots.find((s) => s.id === 'back');
    const forward = slots.find((s) => s.id === 'forward');
    expect(back?.type === 'action' && back.disabled).toBe(false);
    expect(forward?.type === 'action' && forward.disabled).toBe(true);
  });

  test('solving after back: hint + back + forward', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'solving', canGoBack: true, canGoForward: true })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward']);
    const forward = slots.find((s) => s.id === 'forward');
    expect(forward?.type === 'action' && forward.disabled).toBe(false);
  });

  test('loading: hint + back + forward all disabled', () => {
    const slots = buildChessPuzzleActionBarPlan(
      input({ status: 'loading', canGoBack: true, canGoForward: true })
    );
    expect(ids(slots)).toEqual(['hint', 'back', 'forward']);
    const hint = slots[0];
    const back = slots[1];
    const forward = slots[2];
    expect(hint?.id === 'hint' && hint.disabled).toBe(true);
    expect(back?.id === 'back' && back.disabled).toBe(true);
    expect(forward?.id === 'forward' && forward.disabled).toBe(true);
  });

  test('wrong: solution + next action + danger retry button', () => {
    const slots = buildChessPuzzleActionBarPlan(input({ status: 'wrong' }));
    expect(ids(slots)).toEqual(['solution', 'next', 'retry']);
    const retry = slots.find((s) => s.id === 'retry');
    expect(retry).toEqual({ id: 'retry', type: 'button', intent: 'danger' });
    const next = slots.find((s) => s.id === 'next');
    expect(next?.type).toBe('action');
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
