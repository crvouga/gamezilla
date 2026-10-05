import type { FormulaWire } from '@pkgs/matchmaking-root-shared/formula-wire';
import type { MatchmakingSchema } from '@pkgs/matchmaking-root-shared/schema';

export const CHESS_POOL_KEY = 'matchmaking/pool';
export const CHESS_RATING_KEY = 'player/rating';
export const CHESS_TIME_CONTROL_KEY = 'chess/time-control';

/** One matchmaking pool per time control. */
export function chessOpponentPool(timeControl: string): string {
  return `chess.${timeControl}`;
}

export const CHESS_SEARCH_SCHEMA: MatchmakingSchema = {
  partitionKeys: [CHESS_POOL_KEY],
  primaryNumericKey: CHESS_RATING_KEY,
  bucketWidth: 50,
};
export const CHESS_SEARCH_RADIUS = {
  baseRadius: 50,
  radiusGrowthPerSecond: 10,
  maxRadius: 400,
};
export const CHESS_SEARCH_FORMULAS: readonly FormulaWire[] = [
  {
    numeric: [{ path: CHESS_RATING_KEY, weight: 1 }],
    partition: [{ path: CHESS_POOL_KEY }],
  },
];
