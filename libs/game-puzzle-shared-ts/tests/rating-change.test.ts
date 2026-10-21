import { describe, expect, test } from 'bun:test';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { derivePuzzleRatingChange } from '@libs/game-puzzle-shared-ts/rating-change';
import type { PuzzleRatingEvent } from '@libs/game-puzzle-shared-ts/rating-event';

function row(
  kind: PuzzleInteractionRow['kind'],
  at: string
): PuzzleInteractionRow {
  return {
    puzzleId: 'p1',
    kind,
    solveIdx: 0,
    uci: null,
    correct: null,
    puzzleRating: 1500,
    at,
  };
}

function event(at: string, before: number, after: number): PuzzleRatingEvent {
  return {
    puzzleId: 'p1',
    puzzleRating: 1500,
    outcome: after > before ? 'solved' : 'failed',
    scorePermille: after > before ? 1000 : 0,
    ratingBefore: before,
    ratingAfter: after,
    ratingDeviationBefore: 80,
    ratingDeviationAfter: 78,
    at,
  };
}

const T1 = '2026-10-05T10:00:00.000Z';
const T2 = '2026-10-05T10:01:00.000Z';
const T3 = '2026-10-05T10:02:00.000Z';

describe('derivePuzzleRatingChange', () => {
  test('nothing to show before the outcome is decided', () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p1',
        interactions: [row('started', T1)],
        ratingEvents: [],
      })
    ).toEqual({ kind: 'none' });
  });

  test('the outcome of this play shows its rating change', () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p1',
        interactions: [row('started', T1), row('failed', T2)],
        ratingEvents: [event(T2, 1500, 1488)],
      })
    ).toEqual({ kind: 'rated', delta: -12 });
  });

  test('a repeat of a puzzle rated in an earlier play is unrated', () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p1',
        interactions: [
          row('started', T1),
          row('solved', T1),
          row('started', T3),
        ],
        ratingEvents: [event(T2, 1500, 1510)],
      })
    ).toEqual({ kind: 'unrated' });
  });

  // regression: puzzle-link-repeat-same-instant
  test('a repeat started the instant the rated play ended is unrated', () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p1',
        interactions: [
          row('started', T1),
          row('solved', T2),
          row('started', T2),
        ],
        ratingEvents: [event(T2, 1500, 1510)],
      })
    ).toEqual({ kind: 'unrated' });
  });

  test('a first play solved at once still shows its rating change', () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p1',
        interactions: [row('started', T2), row('solved', T2)],
        ratingEvents: [event(T2, 1500, 1510)],
      })
    ).toEqual({ kind: 'rated', delta: 10 });
  });

  test("another puzzle's rating event never counts", () => {
    expect(
      derivePuzzleRatingChange({
        puzzleId: 'p2',
        interactions: [],
        ratingEvents: [event(T2, 1500, 1510)],
      })
    ).toEqual({ kind: 'none' });
  });
});
