import { describe, expect, test } from 'bun:test';

import { deriveChessPuzzleCellFeedback } from '@libs/chess-puzzle-shared/cell-feedback';

describe('deriveChessPuzzleCellFeedback', () => {
  const none = {
    status: 'solving' as const,
    wrongFromSquare: null,
    wrongToSquare: null,
    expectedFromSquare: null,
  };

  test('empty when nothing to show', () => {
    expect(deriveChessPuzzleCellFeedback(none)).toEqual({});
  });

  test('wrong move: cross on origin and target', () => {
    expect(
      deriveChessPuzzleCellFeedback({
        ...none,
        status: 'wrong',
        wrongFromSquare: 'e2',
        wrongToSquare: 'e5',
      })
    ).toEqual({
      e2: { kind: 'cross' },
      e5: { kind: 'cross' },
    });
  });

  test('hint dot only while solving', () => {
    expect(
      deriveChessPuzzleCellFeedback({ ...none, expectedFromSquare: 'g1' })
    ).toEqual({ g1: { kind: 'dot', corner: 'center' } });
    expect(
      deriveChessPuzzleCellFeedback({
        ...none,
        status: 'wrong',
        expectedFromSquare: 'g1',
      })
    ).toEqual({});
  });
});
