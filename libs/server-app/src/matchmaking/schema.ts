import type { MatchmakingSchema } from '@pkgs/matchmaking/interface';

/** Stable configuration of the server's generic matchmaking surface. */
export const MATCHMAKING_SCHEMA: MatchmakingSchema = {
  partitionKeys: [],
  bucketWidth: 50,
};

/** Clock and id ports are supplied by the request composition root. */
export const MATCHMAKING_TUNING = { maxPairsPerPass: 500 } as const;
