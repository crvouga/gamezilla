import { describe, expect, test } from 'bun:test';

import {
  chessPuzzleSyncRatingBands,
  clampPuzzleFeedAutoOffset,
  clampPuzzleFeedRating,
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  isChessPuzzleFeedConfig,
  readChessPuzzleFeedConfig,
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

describe('clampPuzzleFeedAutoOffset', () => {
  test('clamps to ±400', () => {
    expect(clampPuzzleFeedAutoOffset(-999)).toBe(-400);
    expect(clampPuzzleFeedAutoOffset(999)).toBe(400);
  });

  test('falls back for non-finite', () => {
    expect(clampPuzzleFeedAutoOffset(Number.NaN)).toBe(0);
  });
});

describe('isChessPuzzleFeedConfig / readChessPuzzleFeedConfig', () => {
  test('accepts valid configs', () => {
    expect(isChessPuzzleFeedConfig(DEFAULT_CHESS_PUZZLE_FEED_CONFIG)).toBe(
      true
    );
    expect(
      isChessPuzzleFeedConfig({
        mode: 'custom',
        customRating: 800,
        autoOffset: 50,
      })
    ).toBe(true);
  });

  test('accepts legacy rows missing autoOffset and fills 0', () => {
    expect(isChessPuzzleFeedConfig({ mode: 'custom', customRating: 800 })).toBe(
      true
    );
    expect(
      readChessPuzzleFeedConfig({ mode: 'auto', customRating: 1200 })
    ).toEqual({
      mode: 'auto',
      customRating: 1200,
      autoOffset: 0,
    });
  });

  test('rejects invalid shapes', () => {
    expect(isChessPuzzleFeedConfig(null)).toBe(false);
    expect(isChessPuzzleFeedConfig({ mode: 'auto' })).toBe(false);
    expect(isChessPuzzleFeedConfig({ mode: 'other', customRating: 1200 })).toBe(
      false
    );
    expect(
      isChessPuzzleFeedConfig({
        mode: 'auto',
        customRating: 1200,
        autoOffset: 'x',
      })
    ).toBe(false);
  });
});

describe('resolveEffectivePuzzleRating', () => {
  test('auto uses profile rating when positive and offset is 0', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'auto', customRating: 800, autoOffset: 0 },
        profileRating: 1450,
      })
    ).toBe(1450);
  });

  test('auto applies signed offset to profile rating', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'auto', customRating: 800, autoOffset: 100 },
        profileRating: 1450,
      })
    ).toBe(1550);
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'auto', customRating: 800, autoOffset: -200 },
        profileRating: 1450,
      })
    ).toBe(1250);
  });

  test('auto falls back to default when profile missing, then applies offset', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
        profileRating: 0,
      })
    ).toBe(1200);
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'auto', customRating: 800, autoOffset: 50 },
        profileRating: 0,
      })
    ).toBe(1250);
  });

  test('custom uses clamped custom rating', () => {
    expect(
      resolveEffectivePuzzleRating({
        config: { mode: 'custom', customRating: 50, autoOffset: 100 },
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
