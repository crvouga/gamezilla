/**
 * Chess's drawing of the watchers' suggestions: one arrow per member, and
 * the chip label. The suggestion map itself is the platform's.
 */

import type {
  PuzzleRecommendationEntry,
  PuzzleRecommendationMap,
} from '@libs/game-puzzle-shared/recommendations';
import { sortedRecommendations } from '@libs/game-puzzle-shared/recommendations';
import type { BoardArrow, Square } from '@pkgs/chess-board-core-shared/types';

const SQUARE_PATTERN = /^[a-h][1-8]$/;

/** Board coordinate guard (wire payloads carry unvalidated strings). */
export function isBoardSquare(v: unknown): v is Square {
  return typeof v === 'string' && SQUARE_PATTERN.test(v);
}

const EMPTY_ARROWS: readonly BoardArrow[] = Object.freeze([]);

/**
 * Board arrows for every suggestion except `excludeMemberId` (the viewer who
 * drew theirs locally — the board already renders their own drag).
 */
export function recommendationArrows(args: {
  readonly recommendations: PuzzleRecommendationMap;
  readonly colorFor: (memberId: string) => string;
  readonly excludeMemberId?: string | null;
}): readonly BoardArrow[] {
  const entries = sortedRecommendations(args.recommendations).filter(
    (entry) => entry.by !== args.excludeMemberId
  );
  if (entries.length === 0) return EMPTY_ARROWS;
  return entries.map((entry) => ({
    from: entry.from as Square,
    to: entry.to as Square,
    color: args.colorFor(entry.by),
    id: `rec:${entry.by}`,
  }));
}

/** Human label for a suggestion chip, e.g. `e2→e4`. */
export function formatRecommendedMove(
  from: PuzzleRecommendationEntry['from'],
  to: PuzzleRecommendationEntry['to']
): string {
  return `${from}→${to}`;
}
