import { describe, expect, test } from 'bun:test';

import {
  CHESS_PUZZLE_MAX_RECOMMENDATIONS,
  type ChessPuzzleRecommendationMap,
  clearRecommendation,
  formatRecommendedMove,
  parseRecommendations,
  recommendationArrows,
  recommendMove,
  sortedRecommendations,
} from '@libs/chess/public/puzzle-session';

describe('puzzle recommendations', () => {
  test('inserts, replaces, sorts, and clears by member', () => {
    let current: ChessPuzzleRecommendationMap = recommendMove({
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
    expect(formatRecommendedMove('e2', 'e4')).toBe('e2→e4');
  });

  test('evicts the oldest suggestion at the cap and renders colored arrows', () => {
    let current: ChessPuzzleRecommendationMap = {};
    for (let i = 0; i < CHESS_PUZZLE_MAX_RECOMMENDATIONS + 1; i += 1) {
      current = recommendMove({
        current,
        by: `member-${i}`,
        from: 'e2',
        to: 'e4',
      });
    }
    expect(Object.keys(current)).not.toContain('member-0');
    const arrows = recommendationArrows({
      recommendations: current,
      colorFor: (memberId) => `color:${memberId}`,
      excludeMemberId: 'member-1',
    });
    expect(arrows).toHaveLength(CHESS_PUZZLE_MAX_RECOMMENDATIONS - 1);
    expect(arrows[0]?.color).toMatch(/^color:/);
    expect(arrows.some((arrow) => arrow.id === 'rec:member-1')).toBe(false);
  });

  test('drops malformed persisted records', () => {
    expect(
      parseRecommendations({ bad: { from: 'z9', to: 'e4', seq: 1 } })
    ).toEqual({});
    expect(
      parseRecommendations({ good: { from: 'e2', to: 'e4', seq: 1 } })
    ).toEqual({
      good: { from: 'e2', to: 'e4', seq: 1 },
    });
  });
});
