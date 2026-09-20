import { describe, expect, test } from 'bun:test';
import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import type { ChessPuzzleRatingEvent } from '@libs/chess/public/chess-puzzle-rating-event';
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

function event(
  partial: Partial<ChessPuzzleRatingEvent> &
    Pick<ChessPuzzleRatingEvent, 'puzzleId'>
): ChessPuzzleRatingEvent {
  return {
    puzzleRating: 1500,
    outcome: 'solved',
    scorePermille: 1000,
    ratingBefore: 1500,
    ratingAfter: 1580,
    ratingDeviationBefore: 350,
    ratingDeviationAfter: 290,
    at: '2026-01-01T00:00:01.000Z',
    ...partial,
  };
}

describe('derivePuzzleCompletion (§8 ledger)', () => {
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
        ratingEvents: [],
        profileRating: 1500,
      })
    ).toBeNull();
  });

  test('a solved play reports the ledger delta and the streak', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-01T00:00:00.000Z' }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        puzzleRating: 1420,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
        ratingEvents: [
          event({ puzzleId: 'p1', ratingBefore: 1500, ratingAfter: 1552 }),
        ],
        profileRating: 1552,
      })
    ).toEqual({
      outcome: 'solved',
      ratingBefore: 1500,
      ratingAfter: 1552,
      delta: 52,
      streak: 1,
      puzzleRating: 1420,
      rated: true,
    });
  });

  test('an abandoned play reports the ledger loss', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-01T00:00:00.000Z' }),
      row({
        kind: 'abandoned',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:01.000Z',
      }),
    ];
    const completion = derivePuzzleCompletion({
      interactions,
      puzzleId: 'p1',
      allInteractions: interactions,
      ratingEvents: [
        event({
          puzzleId: 'p1',
          outcome: 'abandoned',
          scorePermille: 0,
          ratingBefore: 1500,
          ratingAfter: 1441,
        }),
      ],
      profileRating: 1441,
    });
    expect(completion?.outcome).toBe('abandoned');
    expect(completion?.delta).toBeLessThan(0);
    expect(completion?.rated).toBe(true);
  });

  /** §8 / §9: a puzzle only ever moves the rating once. */
  test('a repeat play of the same puzzle is unrated and shows no delta', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-01T00:00:00.000Z' }),
      row({ kind: 'failed', puzzleId: 'p1', at: '2026-01-01T00:00:01.000Z' }),
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-02T00:00:00.000Z' }),
      row({ kind: 'solved', puzzleId: 'p1', at: '2026-01-02T00:00:01.000Z' }),
    ];
    const completion = derivePuzzleCompletion({
      interactions,
      puzzleId: 'p1',
      allInteractions: interactions,
      ratingEvents: [
        event({
          puzzleId: 'p1',
          outcome: 'failed',
          scorePermille: 0,
          ratingBefore: 1500,
          ratingAfter: 1441,
          at: '2026-01-01T00:00:01.000Z',
        }),
      ],
      profileRating: 1441,
    });
    expect(completion?.outcome).toBe('solved');
    expect(completion?.rated).toBe(false);
    expect(completion?.delta).toBe(0);
    expect(completion?.ratingAfter).toBe(1441);
  });

  test('ignores terminal rows from an earlier play of the same puzzle', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-01T00:00:00.000Z' }),
      row({ kind: 'solved', puzzleId: 'p1', at: '2026-01-01T00:00:01.000Z' }),
      row({ kind: 'started', puzzleId: 'p1', at: '2026-01-01T00:00:02.000Z' }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
        ratingEvents: [event({ puzzleId: 'p1' })],
        profileRating: 1580,
      })
    ).toBeNull();
  });
});
