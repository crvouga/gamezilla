import type { FormulaWire } from '@pkgs/matchmaking-shared/formula-wire';
import type { MatchmakingSchema } from '@pkgs/matchmaking-shared/schema';

export const CHESS_OPPONENT_POOL = 'chess.casual';
export const CHESS_SEARCH_SCHEMA: MatchmakingSchema = {
  partitionKeys: ['matchmaking/pool'],
  primaryNumericKey: 'player/rating',
  bucketWidth: 50,
};
export const CHESS_SEARCH_RADIUS = {
  baseRadius: 50,
  radiusGrowthPerSecond: 10,
  maxRadius: 400,
};
export const CHESS_SEARCH_FORMULAS: readonly FormulaWire[] = [
  {
    numeric: [{ path: 'player/rating', weight: 1 }],
    partition: [{ path: 'matchmaking/pool' }],
  },
];
