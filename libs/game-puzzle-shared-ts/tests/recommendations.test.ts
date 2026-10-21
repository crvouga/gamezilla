import { describe, expect, test } from 'bun:test';
import type { PuzzleRecommendationMap } from '@libs/game-puzzle-shared-ts/recommendations';
import {
  clearRecommendation,
  PUZZLE_MAX_RECOMMENDATIONS,
  parseRecommendations,
  recommendMove,
  sortedRecommendations,
} from '@libs/game-puzzle-shared-ts/recommendations';

describe('puzzle recommendations', () => {
  test('inserts, replaces, sorts, and clears by member', () => {
    let current: PuzzleRecommendationMap = recommendMove({
      current: {},
      by: 'bob',
      from: 'e2',
      to: 'e4',
    });
    current = recommendMove({ current, by: 'carol', from: 'd2', to: 'd4' });
    current = recommendMove({ current, by: 'bob', from: 'g1', to: 'f3' });
    expect(sortedRecommendations(current).map((entry) => entry.by)).toEqual([
      'carol',
      'bob',
    ]);
    expect(current['bob']?.from).toBe('g1');
    expect(Object.keys(clearRecommendation(current, 'carol'))).toEqual(['bob']);
  });

  test('evicts the oldest suggestion at the cap', () => {
    let current: PuzzleRecommendationMap = {};
    for (let i = 0; i < PUZZLE_MAX_RECOMMENDATIONS + 1; i += 1) {
      current = recommendMove({
        current,
        by: `member-${i}`,
        from: 'e2',
        to: 'e4',
      });
    }
    expect(Object.keys(current)).not.toContain('member-0');
    expect(Object.keys(current)).toHaveLength(PUZZLE_MAX_RECOMMENDATIONS);
  });

  test('drops malformed persisted records', () => {
    expect(
      parseRecommendations({
        blank: { from: '', to: 'e4', seq: 1 },
        spaced: { from: 'e 2', to: 'e4', seq: 2 },
        unordered: { from: 'e2', to: 'e4', seq: -1 },
      })
    ).toEqual({});
    expect(
      parseRecommendations({ good: { from: 'e2', to: 'e4', seq: 1 } })
    ).toEqual({
      good: { from: 'e2', to: 'e4', seq: 1 },
    });
  });
});
