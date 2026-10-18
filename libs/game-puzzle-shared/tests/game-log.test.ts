import { describe, expect, test } from 'bun:test';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared/interaction-entities';
import type { PuzzleRatingEvent } from '@libs/game-puzzle-shared/rating-event';
import { derivePuzzleGameLog } from '@libs/game-puzzle-shared/stats';

function row(
  puzzleId: string,
  kind: PuzzleInteractionRow['kind'],
  at: string
): PuzzleInteractionRow {
  return {
    puzzleId,
    kind,
    solveIdx: 0,
    uci: null,
    correct: null,
    puzzleRating: 1458,
    at,
  };
}

function event(puzzleId: string, at: string): PuzzleRatingEvent {
  return {
    puzzleId,
    puzzleRating: 1458,
    outcome: 'solved',
    scorePermille: 1000,
    ratingBefore: 1500,
    ratingAfter: 1512,
    ratingDeviationBefore: 80,
    ratingDeviationAfter: 78,
    at,
  };
}

const at = (minute: number) =>
  `2026-10-05T10:${String(minute).padStart(2, '0')}:00.000Z`;

describe('derivePuzzleGameLog', () => {
  test('a rated puzzle shows its outcome, own rating and rating change', () => {
    expect(
      derivePuzzleGameLog(
        [event('p1', at(1))],
        [row('p1', 'started', at(0)), row('p1', 'solved', at(1))]
      )
    ).toEqual([
      {
        puzzleId: 'p1',
        puzzleRating: 1458,
        outcome: 'solved',
        ratingBefore: 1500,
        ratingAfter: 1512,
        delta: 12,
        rated: true,
        at: at(1),
      },
    ]);
  });

  test('a repeat of a rated puzzle is logged as unrated, newest first', () => {
    const log = derivePuzzleGameLog(
      [event('p1', at(1))],
      [
        row('p1', 'started', at(0)),
        row('p1', 'solved', at(1)),
        row('p1', 'started', at(5)),
        row('p1', 'failed', at(6)),
      ]
    );
    expect(log.map((entry) => [entry.outcome, entry.rated, entry.at])).toEqual([
      ['failed', false, at(6)],
      ['solved', true, at(1)],
    ]);
    expect(log[0]?.delta).toBe(0);
  });

  test('a play still being solved is not logged', () => {
    expect(
      derivePuzzleGameLog(
        [event('p1', at(1))],
        [
          row('p1', 'started', at(0)),
          row('p1', 'solved', at(1)),
          row('p1', 'started', at(5)),
        ]
      )
    ).toHaveLength(1);
  });
});
