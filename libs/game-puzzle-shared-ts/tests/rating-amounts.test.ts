/**
 * Exact rating-change amounts (§8): by the gap between the solver's rating
 * and the puzzle's own rating, settled vs provisional, and clamped to the
 * rating floor 400 and ceiling 3000. Pinned so any change to the formula is
 * a deliberate one.
 */

import { describe, expect, test } from 'bun:test';
import {
  applyPuzzleAttemptRating,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  PUZZLE_RATING_MAX,
  PUZZLE_RATING_MIN,
  PUZZLE_RATING_RD_MIN,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/game-puzzle-shared-ts/rating';

const { win, half, loss } = PUZZLE_SCORE_PERMILLE;

function change(args: {
  rating?: number;
  rd: number;
  puzzle: number;
  score: number;
}): number {
  const rating = args.rating ?? 1500;
  const next = applyPuzzleAttemptRating({
    player: {
      rating,
      ratingDeviation: args.rd,
      volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
    },
    puzzleRating: args.puzzle,
    puzzleRatingDeviation: 75,
    scorePermille: args.score,
  });
  return next.rating - rating;
}

const SETTLED = PUZZLE_RATING_RD_MIN;
const PROVISIONAL = PUZZLE_RATING_DEFAULT_RD;

describe('rating change by the rating gap, settled 1500', () => {
  test.each([
    [1300, win, 1],
    [1300, half, -1],
    [1300, loss, -4],
    [1500, win, 3],
    [1500, half, 0],
    [1500, loss, -3],
    [1700, win, 4],
    [1700, half, 1],
    [1700, loss, -1],
  ])('puzzle %i, score %i: %i', (puzzle, score, delta) => {
    expect(change({ rd: SETTLED, puzzle, score })).toBe(delta);
  });
});

describe('rating change by the rating gap, provisional 1500', () => {
  test.each([
    [1300, win, 99],
    [1300, half, -102],
    [1300, loss, -302],
    [1500, win, 175],
    [1500, half, 0],
    [1500, loss, -175],
    [1700, win, 302],
    [1700, half, 102],
    [1700, loss, -99],
  ])('puzzle %i, score %i: %i', (puzzle, score, delta) => {
    expect(change({ rd: PROVISIONAL, puzzle, score })).toBe(delta);
  });
});

describe('the fairness the amounts add up to', () => {
  test('a harder puzzle solved gains more; an easier one failed costs more', () => {
    for (const rd of [SETTLED, PROVISIONAL]) {
      expect(change({ rd, puzzle: 1700, score: win })).toBeGreaterThan(
        change({ rd, puzzle: 1300, score: win })
      );
      expect(change({ rd, puzzle: 1300, score: loss })).toBeLessThan(
        change({ rd, puzzle: 1700, score: loss })
      );
    }
  });

  test('a provisional rating moves further than a settled one', () => {
    for (const score of [win, loss]) {
      expect(
        Math.abs(change({ rd: PROVISIONAL, puzzle: 1500, score }))
      ).toBeGreaterThan(Math.abs(change({ rd: SETTLED, puzzle: 1500, score })));
    }
  });

  test('half credit sits between a clean solve and a loss', () => {
    const clean = change({ rd: PROVISIONAL, puzzle: 1500, score: win });
    const halfCredit = change({ rd: PROVISIONAL, puzzle: 1500, score: half });
    expect(halfCredit).toBeLessThan(clean);
    expect(halfCredit).toBeGreaterThan(
      change({ rd: PROVISIONAL, puzzle: 1500, score: loss })
    );
  });
});

describe('the rating floor and ceiling', () => {
  test('the floor and ceiling are 400 and 3000', () => {
    expect(PUZZLE_RATING_MIN).toBe(400);
    expect(PUZZLE_RATING_MAX).toBe(3000);
  });

  test('failing at the floor stays at 400; solving there rises', () => {
    expect(change({ rating: 400, rd: SETTLED, puzzle: 400, score: loss })).toBe(
      0
    );
    expect(
      change({ rating: 400, rd: SETTLED, puzzle: 1200, score: win })
    ).toBeGreaterThan(0);
  });

  test('solving at the ceiling stays at 3000; failing there drops', () => {
    expect(
      change({ rating: 3000, rd: SETTLED, puzzle: 3000, score: win })
    ).toBe(0);
    expect(
      change({ rating: 3000, rd: SETTLED, puzzle: 1672, score: loss })
    ).toBeLessThan(0);
  });

  test('a provisional loss far below the floor still clamps to 400', () => {
    expect(
      change({ rating: 450, rd: PROVISIONAL, puzzle: 400, score: loss })
    ).toBe(PUZZLE_RATING_MIN - 450);
  });
});
