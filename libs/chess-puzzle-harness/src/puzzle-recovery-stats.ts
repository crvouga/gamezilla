import type { ProductHarness } from '@libs/harness/harness';
import { GLICKO2_DEFAULT, glicko2Update } from '@pkgs/glicko2-shared/glicko2';
import {
  readGameLogRowTitle,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingHistory,
} from './chess-puzzle-ui';

/** Decided import fixtures, independent of the product's result/rating code. */
const OPPONENTS: Record<string, readonly [number, number]> = {
  '007hv': [1275, 112],
  '01zsb': [1220, 286],
  '01Xbe': [1190, 76],
};

function displayedResult(title: string | null, rating: number, puzzle: string) {
  if (title === null && rating === 1500) return 'Unfinished';
  const opponent = OPPONENTS[puzzle];
  if (opponent === undefined)
    throw new Error(`Unknown recovery fixture ${puzzle}`);
  const ratingFor = (score: number) =>
    Math.round(
      glicko2Update(GLICKO2_DEFAULT, [
        {
          opponentRating: opponent[0],
          opponentRd: opponent[1],
          score,
        },
      ]).rating
    );
  if (title?.startsWith('Solved') && rating === ratingFor(1))
    return 'CleanSolve';
  if (title?.startsWith('Solved') && rating === ratingFor(0.5))
    return 'HintedSolve';
  if (title?.startsWith('Failed') && rating === ratingFor(0.5))
    return 'WrongMove';
  if (title?.startsWith('Failed') && rating === ratingFor(0))
    return 'ShownSolution';
  if (title?.startsWith('Abandoned') && rating === ratingFor(0))
    return 'Skipped';
  return `Contradictory displayed result: ${title}/${rating}`;
}

export async function readRecoveryStats(
  s: ProductHarness,
  device: string,
  puzzle: string
) {
  const title = await readGameLogRowTitle(s, device, puzzle);
  const rating = await readStatsElo(s, device);
  const played = await readStatsPlayed(s, device);
  const history = await readStatsRatingHistory(s, device);
  if (rating === null || played === null)
    throw new Error('Stats are not displayed');
  if (played > 1 || history.length > 1)
    throw new Error('Displayed progress counted one puzzle twice');
  const result = displayedResult(title, rating, puzzle);
  const counted = result !== 'Unfinished';
  if (played !== Number(counted) || history.length !== Number(counted))
    return { gameLog: 'contradictory', ratedResult: result };
  const gameLog = title?.startsWith('Solved')
    ? 'solved'
    : title?.startsWith('Failed')
      ? 'failed'
      : title?.startsWith('Abandoned')
        ? 'abandoned'
        : 'unfinished';
  return { gameLog, ratedResult: result };
}
