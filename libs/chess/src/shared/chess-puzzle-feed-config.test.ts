import { describe, expect, test } from 'bun:test';

import {
  chessPuzzleSyncRatingBands,
  clampPuzzleFeedRating,
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  isChessPuzzleFeedConfig,
  resolveEffectivePuzzleRating,
} from './chess-puzzle-feed-config';

describe('clampPuzzleFeedRating', () => {
  test('clamps below min and above max', () => {
    expect(clampPuzzleFeedRating(100)).toBe(400);
    expect(clampPuzzleFeedRating(9999)).toBe(3000);
  });

  test('rounds finite values inside range', () => {
    expect(clampPuzzleFeedRating(1250.6)).toBe(1251);
  });

  test('falls back for non-finite', () => {
    expect(clampPuzzleFeedRating(Number.NaN)).toBe(1200);
  });
});

describe('isChessPuzzleFeedConfig', () => {
  test('accepts valid configs', () => {
    expect(isChessPuzzleFeedConfig(DEFAULT_CHESS_PUZZLE_FEED_CONFIG)).toBe(
      true
    );
    expect(
      isChessPuzzleFeedConfig({ mode: 'custom', customRating: 800 })
    ).toBe(true);
  });

  test('rejects invalid shapes', () => {
    expect(isChessPuzzleFeedConfig(null)).toBe(false);
    expect(isChessPuzzleFeedConfig({ mode: 'auto' })).toBe(false);
    expect(
      isChessPuzzleFeedConfig({ mode: 'other', customRating: 1200 })
    ).toBe(false);
  });
});

describe('resolveEffectivePuzzleRating', () => {
  test('auto uses profile rating when positive', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'auto', customRating: 800 },
        profileRating: 1450,
      })
    ).toBe(1450);
  });

  test('auto falls back to default when profile missing', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
        profileRating: 0,
      })
    ).toBe(1200);
  });

  test('custom uses clamped custom rating', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'custom', customRating: 50 },
        profileRating: 1450,
      })
    ).toBe(400);
  });
});

describe('chessPuzzleSyncRatingBands', () => {
  test('returns center band ± 2', () => {
    expect(chessPuzzleSyncRatingBands(1200)).toEqual([1, 2, 3, 4, 5]);
  });

  test('does not emit negative bands', () => {
    expect(chessPuzzleSyncRatingBands(100)).toEqual([0, 1, 2]);
  });
});
