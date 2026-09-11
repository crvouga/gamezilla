import { describe, expect, test } from 'bun:test';

import {
  deriveChessPuzzleCellFeedback,
  deriveChessPuzzleCellHighlights,
} from '@libs/chess/public/puzzle-session';

describe('deriveChessPuzzleCellFeedback', () => {
  const none = {
    status: 'solving' as const,
    wrongFromSquare: null,
    wrongToSquare: null,
    expectedFromSquare: null,
    showSolvedCrownOn: null,
    lastCorrectToSquare: null,
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

  test('crown wins over star on the same square', () => {
    expect(
      deriveChessPuzzleCellFeedback({
        ...none,
        status: 'solved',
        lastCorrectToSquare: 'h7',
        showSolvedCrownOn: 'h7',
      })
    ).toEqual({ h7: { kind: 'crown' } });
  });
});

describe('deriveChessPuzzleCellHighlights', () => {
  test('rings the last correct target', () => {
    expect(
      deriveChessPuzzleCellHighlights({
        status: 'solving',
        lastCorrectToSquare: 'd4',
        solvedKingSquare: null,
        successColor: '#0f0',
      })
    ).toEqual({ d4: { color: '#0f0', ring: true, opacity: 0.75 } });
  });

  test('king ring only once solved', () => {
    const args = {
      status: 'solving' as const,
      lastCorrectToSquare: null,
      solvedKingSquare: 'e8' as const,
      successColor: '#0f0',
    };
    expect(deriveChessPuzzleCellHighlights(args)).toEqual({});
    expect(
      deriveChessPuzzleCellHighlights({ ...args, status: 'solved' })
    ).toEqual({ e8: { color: '#0f0', ring: true, opacity: 0.9 } });
  });
});
