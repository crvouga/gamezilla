/**
 * Multiplayer ratings: one Glicko-2 rating per speed (Mark Glickman,
 * "Example of the Glicko-2 system"), one rating period per finished game.
 *
 * Stored integral like the puzzle rating: rating and deviation rounded,
 * volatility in micros, so every engine rounds a result to the same value.
 */

import {
  GLICKO2_DEFAULT_RATING,
  GLICKO2_DEFAULT_RD,
  GLICKO2_DEFAULT_TAU,
  GLICKO2_DEFAULT_VOLATILITY,
  glicko2Update,
} from '@pkgs/glicko2-shared-ts/glicko2';

const VOLATILITY_SCALE = 1_000_000;
const RATING_MIN = 400;
const RATING_MAX = 3200;
const RD_MIN = 45;
const VOLATILITY_MICROS_MIN = 1_000;
const VOLATILITY_MICROS_MAX = 500_000;

/** A rating settles (loses its "?") after this many rated games at its speed. */
export const MULTIPLAYER_SETTLED_GAMES = 12;

export type MultiplayerRating = {
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly volatilityMicros: number;
  /** Rated multiplayer games played at this speed. */
  readonly games: number;
};

export const NEW_MULTIPLAYER_RATING: MultiplayerRating = {
  rating: GLICKO2_DEFAULT_RATING,
  ratingDeviation: GLICKO2_DEFAULT_RD,
  volatilityMicros: Math.round(GLICKO2_DEFAULT_VOLATILITY * VOLATILITY_SCALE),
  games: 0,
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isProvisional(rating: Pick<MultiplayerRating, 'games'>) {
  return rating.games < MULTIPLAYER_SETTLED_GAMES;
}

/** As people see it: `1620`, or `1500?` while it has not settled. */
export function formatMultiplayerRating(rating: MultiplayerRating): string {
  return `${String(rating.rating)}${isProvisional(rating) ? '?' : ''}`;
}

/** One finished game against `opponent`: score 1 win, 0.5 draw, 0 loss. */
export function rateMultiplayerGame(
  player: MultiplayerRating,
  opponent: MultiplayerRating,
  score: 0 | 0.5 | 1
): MultiplayerRating {
  const next = glicko2Update(
    {
      rating: player.rating,
      rd: player.ratingDeviation,
      volatility: player.volatilityMicros / VOLATILITY_SCALE,
    },
    [
      {
        opponentRating: opponent.rating,
        opponentRd: opponent.ratingDeviation,
        score,
      },
    ],
    { tau: GLICKO2_DEFAULT_TAU, minRd: RD_MIN, maxRd: GLICKO2_DEFAULT_RD }
  );
  return {
    rating: clampInt(next.rating, RATING_MIN, RATING_MAX),
    ratingDeviation: clampInt(next.rd, RD_MIN, GLICKO2_DEFAULT_RD),
    volatilityMicros: clampInt(
      next.volatility * VOLATILITY_SCALE,
      VOLATILITY_MICROS_MIN,
      VOLATILITY_MICROS_MAX
    ),
    games: player.games + 1,
  };
}
