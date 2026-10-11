import { describe, expect, test } from 'bun:test';

import { deriveChessPuzzleCellFeedback } from '@libs/chess-puzzle-shared/cell-feedback';

describe('deriveChessPuzzleCellFeedback', () => {
  const none = {
    status: 'solving' as const,
    wrongToSquare: null,
    expectedFromSquare: null,
  };

  test('empty when nothing to show', () => {
    expect(deriveChessPuzzleCellFeedback(none)).toEqual({});
  });

  test('wrong move: cross only on the square the move ended on', () => {
    expect(
      deriveChessPuzzleCellFeedback({
        ...none,
        status: 'wrong',
        wrongToSquare: 'e5',
      })
    ).toEqual({
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
