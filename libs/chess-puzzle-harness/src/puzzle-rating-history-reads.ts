import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness/puzzle-fixtures';
import { readStatsRatingHistory } from '@libs/game-session-harness/puzzle-records';
import type { ProductHarness } from '@libs/harness/harness';

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
