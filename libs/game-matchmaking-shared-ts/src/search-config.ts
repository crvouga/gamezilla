import type { FormulaWire } from '@pkgs/matchmaking-root-shared-ts/formula-wire';
import type { MatchmakingSchema } from '@pkgs/matchmaking-root-shared-ts/schema';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

export const OPPONENT_POOL_KEY = 'matchmaking/pool';
export const OPPONENT_RATING_KEY = 'player/rating';
export const OPPONENT_TIME_CONTROL_KEY = 'chess/time-control';

/** One matchmaking pool per time control. */
export function opponentPool(timeControl: string, rules: TurnGames): string {
  return `${rules.forControl(timeControl).id}.${timeControl.split('/').at(-1)}`;
}

export const OPPONENT_SEARCH_SCHEMA: MatchmakingSchema = {
  partitionKeys: [OPPONENT_POOL_KEY],
  primaryNumericKey: OPPONENT_RATING_KEY,
  bucketWidth: 50,
};
export const OPPONENT_SEARCH_RADIUS = {
  baseRadius: 50,
  radiusGrowthPerSecond: 10,
  maxRadius: 400,
};
export const OPPONENT_SEARCH_FORMULAS: readonly FormulaWire[] = [
  {
    numeric: [{ path: OPPONENT_RATING_KEY, weight: 1 }],
    partition: [{ path: OPPONENT_POOL_KEY }],
  },
];
