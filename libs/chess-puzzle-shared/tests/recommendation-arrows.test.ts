import { describe, expect, test } from 'bun:test';
import {
  formatRecommendedMove,
  isBoardSquare,
  recommendationArrows,
} from '@libs/chess-puzzle-shared/recommendation-arrows';
import type { PuzzleRecommendationMap } from '@libs/game-puzzle-shared/recommendations';
import {
  PUZZLE_MAX_RECOMMENDATIONS,
  recommendMove,
} from '@libs/game-puzzle-shared/recommendations';

describe('chess suggestion arrows', () => {
  test('a suggestion names two squares of the board', () => {
    expect(isBoardSquare('e2')).toBe(true);
    expect(isBoardSquare('z9')).toBe(false);
    expect(formatRecommendedMove('e2', 'e4')).toBe('e2→e4');
  });

  test('renders one colored arrow per member but the viewer', () => {
    let current: PuzzleRecommendationMap = {};
    for (let i = 0; i < PUZZLE_MAX_RECOMMENDATIONS + 1; i += 1) {
      current = recommendMove({
        current,
        by: `member-${i}`,
        from: 'e2',
        to: 'e4',
      });
    }
    const arrows = recommendationArrows({
      recommendations: current,
      colorFor: (memberId) => `color:${memberId}`,
      excludeMemberId: 'member-1',
    });
    expect(arrows).toHaveLength(PUZZLE_MAX_RECOMMENDATIONS - 1);
    expect(arrows[0]?.color).toMatch(/^color:/);
    expect(arrows.some((arrow) => arrow.id === 'rec:member-1')).toBe(false);
  });
});
