import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness/puzzle-fixtures';
import type { ProductHarness } from '@libs/harness/harness';
import { readStatsRatingHistory } from './chess-puzzle-ui';

/** The increases and decreases drawn in the actual stats history. */
export async function readPuzzleRatingHistoryDirections(
  s: ProductHarness,
  actor: string
) {
  const ratings = await readStatsRatingHistory(s, actor);
  return ratings.map((rating, index) =>
    rating > (ratings[index - 1] ?? PUZZLE_RATING_SCALE.start)
      ? 'solved'
      : 'failed'
  );
}
