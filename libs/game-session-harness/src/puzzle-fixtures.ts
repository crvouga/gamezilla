/**
 * What a puzzle specification is written against: the rating scale every
 * person starts on, and the rated-result write and start charge a quota
 * specification replays.
 */
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared/rate-puzzle-attempt-mutation';
import { ratedStartKey } from '@libs/game-puzzle-shared/rated-start-key';
import {
  PUZZLE_PROVISIONAL_RD,
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  PUZZLE_RATING_RD_MIN,
} from '@libs/game-puzzle-shared/rating';

/**
 * The puzzle rating scale: where a person starts, the deviation above which
 * a rating is still provisional, and the deviation floor.
 */
export const PUZZLE_RATING_SCALE = {
  start: PUZZLE_RATING_DEFAULT,
  startDeviation: PUZZLE_RATING_DEFAULT_RD,
  startVolatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  provisionalDeviation: PUZZLE_PROVISIONAL_RD,
  deviationFloor: PUZZLE_RATING_RD_MIN,
} as const;

/** The idempotency key of the start charge for a rated puzzle on that day. */
export function ratedPuzzleStartKey(puzzleId: string, atMs: number): string {
  return ratedStartKey(puzzleId, atMs);
}

/** The platform's rated-result write, as a quota specification replays it. */
export const RATE_PUZZLE_ATTEMPT = ratePuzzleAttemptMutation;
