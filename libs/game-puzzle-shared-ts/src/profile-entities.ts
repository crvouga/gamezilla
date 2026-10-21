import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';

import {
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  PUZZLE_RATING_MAX,
  PUZZLE_RATING_MIN,
  PUZZLE_RATING_RD_MAX,
  PUZZLE_RATING_RD_MIN,
  PUZZLE_VOLATILITY_MICROS_MAX,
  PUZZLE_VOLATILITY_MICROS_MIN,
} from './rating';

/** Sync entity type for per-user puzzle rating cache (one row per user). */
export const PUZZLE_PROFILE_ENTITY_TYPE = 'chess.puzzle.profile';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNonEmptyString(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > 0 ? t : '';
}

function readBoundedInt(args: {
  min: number;
  max: number;
  dflt: number;
}): (v: unknown) => number {
  const { min, max, dflt } = args;
  return (v: unknown): number => {
    let n = dflt;
    if (typeof v === 'number' && Number.isFinite(v)) n = Math.trunc(v);
    if (typeof v === 'string' && v.trim() !== '') {
      const p = Number.parseInt(v, 10);
      if (Number.isFinite(p)) n = p;
    }
    return Math.min(max, Math.max(min, n));
  };
}

const profNs = createAttrNamespace(
  GAME_PLATFORM_NAMESPACE,
  'puzzle',
  'profile'
);

/** §8 Glicko-2 state, written only by the `ratePuzzleAttempt` mutation. */
export const PuzzleProfileAttr = {
  /** Indexed: profile rows are looked up by ownerId on every play start. */
  ownerId: profNs.text('owner-id', readNonEmptyString).indexed(),
  rating: profNs.integer(
    'rating',
    readBoundedInt({
      min: PUZZLE_RATING_MIN,
      max: PUZZLE_RATING_MAX,
      dflt: PUZZLE_RATING_DEFAULT,
    })
  ),
  ratingDev: profNs.integer(
    'rating-deviation',
    readBoundedInt({
      min: PUZZLE_RATING_RD_MIN,
      max: PUZZLE_RATING_RD_MAX,
      dflt: PUZZLE_RATING_DEFAULT_RD,
    })
  ),
  /** Glicko-2 volatility × 1e6 (integers only on the wire). */
  volatilityMicros: profNs.integer(
    'volatility-micros',
    readBoundedInt({
      min: PUZZLE_VOLATILITY_MICROS_MIN,
      max: PUZZLE_VOLATILITY_MICROS_MAX,
      dflt: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
    })
  ),
  lastInteractionAt: profNs.timestamp('last-interaction-at', readString),
} as const;
