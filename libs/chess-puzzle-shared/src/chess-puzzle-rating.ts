/**
 * §8 puzzle rating: Glicko-2, one rating period per attempt.
 *
 * Every attempt is a game between the player and the puzzle (solve = win,
 * fail = loss). The puzzle's stored rating / deviation is the opponent; the
 * puzzle side does not move yet (that is the §8 `P1` row).
 *
 * The state persisted in `chess_puzzle_profiles` is integral on purpose:
 * Glicko-2 is float math, so rating / RD are rounded and volatility is kept
 * in micros. Rounding once per attempt keeps client and server on the same
 * value whatever their engines do to the last bits of `Math.exp`.
 */

import {
  GLICKO2_DEFAULT_RATING,
  GLICKO2_DEFAULT_RD,
  GLICKO2_DEFAULT_TAU,
  GLICKO2_DEFAULT_VOLATILITY,
  glicko2Update,
} from '@pkgs/glicko2-shared/glicko2';

/** §8: new players start here. */
export const PUZZLE_RATING_DEFAULT = GLICKO2_DEFAULT_RATING;
/** §8: …with maximum uncertainty (the "350–500" end of the range). */
export const PUZZLE_RATING_DEFAULT_RD = GLICKO2_DEFAULT_RD;

export const PUZZLE_VOLATILITY_SCALE = 1_000_000;
export const PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS = Math.round(
  GLICKO2_DEFAULT_VOLATILITY * PUZZLE_VOLATILITY_SCALE
);

export const PUZZLE_RATING_MIN = 400;
export const PUZZLE_RATING_MAX = 3000;
export const PUZZLE_RATING_RD_MIN = 30;
export const PUZZLE_RATING_RD_MAX = GLICKO2_DEFAULT_RD;
export const PUZZLE_VOLATILITY_MICROS_MIN = 1_000;
export const PUZZLE_VOLATILITY_MICROS_MAX = 500_000;

/**
 * §8 provisional marker: the rating shows a "?" until the player's RD drops
 * below this. ~110 is roughly a dozen rated attempts from a cold start.
 */
export const PUZZLE_PROVISIONAL_RD = 110;

/** Deviation used for a puzzle row that carries none (Lichess always does). */
export const PUZZLE_OPPONENT_RD_DEFAULT = 80;

export const PUZZLE_RATING_TAU = GLICKO2_DEFAULT_TAU;

/** Persisted player rating state (all integers — see the file comment). */
export type PuzzleRatingState = {
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly volatilityMicros: number;
};

export const DEFAULT_PUZZLE_RATING_STATE: PuzzleRatingState = {
  rating: PUZZLE_RATING_DEFAULT,
  ratingDeviation: PUZZLE_RATING_DEFAULT_RD,
  volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
};

/** Attempt score in permille so the wire and the DB stay integral. */
export const PUZZLE_SCORE_PERMILLE = {
  loss: 0,
  half: 500,
  win: 1000,
} as const;

export type PuzzleScorePermille =
  (typeof PUZZLE_SCORE_PERMILLE)[keyof typeof PUZZLE_SCORE_PERMILLE];

export function isPuzzleScorePermille(
  value: number
): value is PuzzleScorePermille {
  return (
    value === PUZZLE_SCORE_PERMILLE.loss ||
    value === PUZZLE_SCORE_PERMILLE.half ||
    value === PUZZLE_SCORE_PERMILLE.win
  );
}

export function puzzleScorePermille(score: 0 | 0.5 | 1): PuzzleScorePermille {
  if (score === 1) return PUZZLE_SCORE_PERMILLE.win;
  if (score === 0.5) return PUZZLE_SCORE_PERMILLE.half;
  return PUZZLE_SCORE_PERMILLE.loss;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Reads a stored profile row (or nothing) into usable rating state. */
export function readPuzzleRatingState(row: {
  readonly rating?: unknown;
  readonly ratingDeviation?: unknown;
  readonly volatilityMicros?: unknown;
}): PuzzleRatingState {
  const rating = Number(row.rating);
  const rd = Number(row.ratingDeviation);
  const volatility = Number(row.volatilityMicros);
  return {
    rating:
      Number.isFinite(rating) && rating > 0
        ? clampInt(rating, PUZZLE_RATING_MIN, PUZZLE_RATING_MAX)
        : PUZZLE_RATING_DEFAULT,
    ratingDeviation:
      Number.isFinite(rd) && rd > 0
        ? clampInt(rd, PUZZLE_RATING_RD_MIN, PUZZLE_RATING_RD_MAX)
        : PUZZLE_RATING_DEFAULT_RD,
    volatilityMicros:
      Number.isFinite(volatility) && volatility > 0
        ? clampInt(
            volatility,
            PUZZLE_VOLATILITY_MICROS_MIN,
            PUZZLE_VOLATILITY_MICROS_MAX
          )
        : PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  };
}

/** Opponent deviation for a puzzle row, falling back to the catalog default. */
export function puzzleOpponentRd(ratingDeviation: unknown): number {
  const rd = Number(ratingDeviation);
  if (!Number.isFinite(rd) || rd <= 0) return PUZZLE_OPPONENT_RD_DEFAULT;
  return clampInt(rd, PUZZLE_RATING_RD_MIN, PUZZLE_RATING_RD_MAX);
}

export type PuzzleAttemptRatingInput = {
  readonly player: PuzzleRatingState;
  readonly puzzleRating: number;
  readonly puzzleRatingDeviation: number;
  readonly scorePermille: number;
};

/**
 * The player's rating after one attempt. Pure: the same inputs give the same
 * integers on the client's optimistic apply and on the server's replay.
 */
export function applyPuzzleAttemptRating(
  input: PuzzleAttemptRatingInput
): PuzzleRatingState {
  const next = glicko2Update(
    {
      rating: input.player.rating,
      rd: input.player.ratingDeviation,
      volatility: input.player.volatilityMicros / PUZZLE_VOLATILITY_SCALE,
    },
    [
      {
        opponentRating: clampInt(
          input.puzzleRating,
          PUZZLE_RATING_MIN,
          PUZZLE_RATING_MAX
        ),
        opponentRd: puzzleOpponentRd(input.puzzleRatingDeviation),
        score: input.scorePermille / PUZZLE_SCORE_PERMILLE.win,
      },
    ],
    {
      tau: PUZZLE_RATING_TAU,
      minRd: PUZZLE_RATING_RD_MIN,
      maxRd: PUZZLE_RATING_RD_MAX,
    }
  );
  return {
    rating: clampInt(next.rating, PUZZLE_RATING_MIN, PUZZLE_RATING_MAX),
    ratingDeviation: clampInt(
      next.rd,
      PUZZLE_RATING_RD_MIN,
      PUZZLE_RATING_RD_MAX
    ),
    volatilityMicros: clampInt(
      next.volatility * PUZZLE_VOLATILITY_SCALE,
      PUZZLE_VOLATILITY_MICROS_MIN,
      PUZZLE_VOLATILITY_MICROS_MAX
    ),
  };
}

/** §8: show the "?" marker while the player's rating is still this uncertain. */
export function isProvisionalPuzzleRating(ratingDeviation: number): boolean {
  if (!Number.isFinite(ratingDeviation) || ratingDeviation <= 0) return true;
  return ratingDeviation >= PUZZLE_PROVISIONAL_RD;
}

/** Rating as the UI prints it: `1500` or `1500?` while provisional. */
export function formatPuzzleRating(args: {
  readonly rating: number;
  readonly provisional: boolean;
}): string {
  return `${String(Math.round(args.rating))}${args.provisional ? '?' : ''}`;
}
