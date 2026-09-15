import { describe, expect, test } from 'bun:test';

import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import { updatePuzzleRating } from '@libs/chess/public/chess-puzzle-rating';
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

  test('solved play yields projected delta and streak', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ];
    const expected = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 1,
      ratedGames: 0,
    });
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toEqual({
      outcome: 'solved',
      ratingBefore: 1200,
      ratingAfter: expected.rating,
      delta: expected.rating - 1200,
      streak: 1,
      puzzleRating: 1200,
    });
  });

  test('abandoned play reports negative projected delta', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'abandoned',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ];
    const completion = derivePuzzleCompletion({
      interactions,
      puzzleId: 'p1',
      allInteractions: interactions,
    });
    expect(completion?.outcome).toBe('abandoned');
    expect(completion?.delta).toBeLessThan(0);
  });

  test('ignores terminal rows from an earlier play of the same puzzle', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:01.000Z',
      }),
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:02.000Z',
      }),
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
