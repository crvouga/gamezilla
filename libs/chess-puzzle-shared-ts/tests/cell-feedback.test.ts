import { describe, expect, test } from 'bun:test';

import { chessPuzzleCellFeedback } from '@libs/chess-puzzle-shared-ts/cell-feedback';

describe('chessPuzzleCellFeedback', () => {
  test('empty when nothing to show', () => {
    expect(chessPuzzleCellFeedback({ wrong: null, hint: null })).toEqual({});
  });

  test('wrong move: cross only on the square the move ended on', () => {
    expect(chessPuzzleCellFeedback({ wrong: 'e5', hint: null })).toEqual({
      e5: { kind: 'cross' },
    });
  });

  test('a hint dots the piece it picks', () => {
    expect(chessPuzzleCellFeedback({ wrong: null, hint: 'g1' })).toEqual({
      g1: { kind: 'dot', corner: 'center' },
    });
  });
});
