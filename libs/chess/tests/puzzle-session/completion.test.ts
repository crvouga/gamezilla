import { describe, expect, test } from 'bun:test';

import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import { derivePuzzleCompletion } from '@libs/chess/public/puzzle-session';

function row(
  partial: Partial<ChessPuzzleInteractionRow> &
    Pick<ChessPuzzleInteractionRow, 'kind' | 'puzzleId'>
): ChessPuzzleInteractionRow {
  return {
    solveIdx: 0,
    uci: null,
    correct: null,
    puzzleRating: 1500,
    ratingBefore: 0,
    ratingAfter: 0,
    at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('derivePuzzleCompletion', () => {
  test('null while the current play has no terminal row', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({ kind: 'moved', puzzleId: 'p1', uci: 'e2e4', correct: true }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toBeNull();
  });

  test('solved play yields delta and streak', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        ratingBefore: 1500,
        ratingAfter: 1512,
        puzzleRating: 1480,
      }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toEqual({
      outcome: 'solved',
      ratingBefore: 1500,
      ratingAfter: 1512,
      delta: 12,
      streak: 1,
      puzzleRating: 1480,
    });
  });

  test('abandoned play reports negative delta', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({
        kind: 'abandoned',
        puzzleId: 'p1',
        ratingBefore: 1500,
        ratingAfter: 1490,
      }),
    ];
    const completion = derivePuzzleCompletion({
      interactions,
      puzzleId: 'p1',
      allInteractions: interactions,
    });
    expect(completion?.outcome).toBe('abandoned');
    expect(completion?.delta).toBe(-10);
  });

  test('ignores terminal rows from an earlier play of the same puzzle', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        ratingBefore: 1500,
        ratingAfter: 1512,
      }),
      row({ kind: 'started', puzzleId: 'p1' }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toBeNull();
  });

  test('null when ratings were never recorded', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({ kind: 'solved', puzzleId: 'p1' }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toBeNull();
  });
});
