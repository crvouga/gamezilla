import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_PUZZLE_FEED_CONFIG,
  PUZZLE_FEED_BAND_SPREAD,
  PUZZLE_POOL_RATING_CEILING,
  PUZZLE_RATING_BAND_SIZE,
  puzzleFeedHasNarrowingFilters,
  puzzlePoolRangeForBand,
  puzzlePoolRangesForRating,
  puzzleSyncRatingBands,
  widenPuzzleFeedConfig,
} from '@libs/game-puzzle-shared/feed-config';

describe('puzzleSyncRatingBands', () => {
  test('centers on the rating band and spreads one band each side', () => {
    expect(PUZZLE_FEED_BAND_SPREAD).toBe(1);
    expect(puzzleSyncRatingBands(1200)).toEqual([2, 3, 4]);
    expect(puzzleSyncRatingBands(1599)).toEqual([2, 3, 4]);
    expect(puzzleSyncRatingBands(1600)).toEqual([3, 4, 5]);
  });

  test('clamps at the catalog floor and ceiling', () => {
    expect(puzzleSyncRatingBands(0)).toEqual([0, 1]);
    const top = Math.floor(
      PUZZLE_POOL_RATING_CEILING / PUZZLE_RATING_BAND_SIZE
    );
    expect(puzzleSyncRatingBands(PUZZLE_POOL_RATING_CEILING)).toEqual([
      top - 1,
      top,
    ]);
  });

  test('every rating within a band pick window is covered by its subscriptions', () => {
    for (const rating of [400, 777, 1200, 1999, 2400, 2950]) {
      const ranges = puzzlePoolRangesForRating(rating);
      const lo = Math.max(0, rating - PUZZLE_RATING_BAND_SIZE);
      const hi = rating + PUZZLE_RATING_BAND_SIZE;
      const covers = (r: number) =>
        ranges.some((x) => r >= x.ratingMin && r <= x.ratingMax);
      expect(covers(lo)).toBe(true);
      expect(covers(rating)).toBe(true);
      expect(covers(Math.min(hi, PUZZLE_POOL_RATING_CEILING))).toBe(true);
    }
  });
});

describe('puzzlePoolRangeForBand', () => {
  test('bands are contiguous, inclusive, and never overlap', () => {
    expect(puzzlePoolRangeForBand(0)).toEqual({
      ratingMin: 0,
      ratingMax: 399,
    });
    expect(puzzlePoolRangeForBand(3)).toEqual({
      ratingMin: 1200,
      ratingMax: 1599,
    });
    expect(puzzlePoolRangeForBand(3).ratingMin).toBe(
      puzzlePoolRangeForBand(2).ratingMax + 1
    );
  });

  test('never exceeds the pool params ceiling', () => {
    const top = puzzlePoolRangeForBand(
      Math.floor(PUZZLE_POOL_RATING_CEILING / PUZZLE_RATING_BAND_SIZE)
    );
    expect(top.ratingMax).toBeLessThanOrEqual(PUZZLE_POOL_RATING_CEILING);
    expect(top.ratingMin).toBeLessThanOrEqual(top.ratingMax);
  });
});

describe('widenPuzzleFeedConfig', () => {
  test('default feed narrows by history; widening keeps the rating target', () => {
    expect(puzzleFeedHasNarrowingFilters(DEFAULT_PUZZLE_FEED_CONFIG)).toBe(
      true
    );
    const widened = widenPuzzleFeedConfig({
      ...DEFAULT_PUZZLE_FEED_CONFIG,
      customRating: 1750,
      themes: ['mateIn1'],
    });
    expect(widened.historyFilter).toBe('any');
    expect(widened.themes).toEqual([]);
    expect(widened.customRating).toBe(1750);
    expect(puzzleFeedHasNarrowingFilters(widened)).toBe(false);
  });
});
