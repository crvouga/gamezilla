/**
 * Single source of truth for the API's `MatchmakingSchema` and
 * `MatchmakingTuning`. Imported by [route.ts](./route.ts) which constructs
 * the request-layer `Matchmaking` and forwards both values to `migrate()`.
 *
 * The schema constant lives here (not inline in `route.ts`) so the
 * fingerprint computed by `migrate()` is stable across reboots — the
 * schema_state row keys on it and rebuilds the table on drift.
 */

import type { MatchmakingSchema } from '@pkgs/matchmaking/interface';

/**
 * Hard partition keys, bucketing axis, and bucket width. Add chess-
 * specific keys here (e.g. `'chess/mode'`, `'chess/time-control'`)
 * when wiring per-domain matchmaking.
 */
export const MATCHMAKING_SCHEMA: MatchmakingSchema = {
  partitionKeys: [],
  bucketWidth: 50,
};

/**
 * App-layer drain / sweep tunings. The host advances the queue via
 * `POST /matchmaking/tick` (or `Matchmaking.tick()`).
 *
 * - `maxPairsPerPass: 500`: amortise work per tick.
 * - `maxWaitSeconds: 300`: 5-minute abandonment cutoff; reaped per tick.
 * - `matchedRetentionSeconds: 3600`: matched rows stay queryable for
 *   1h after pairing so the `/status` poll loop can read them.
 */
/** Numeric caps only — `now` / `createId` are wired in `route.ts` from `getIo()`. */
export const MATCHMAKING_TUNING = {
  maxPairsPerPass: 500,
  maxWaitSeconds: 300,
  matchedRetentionSeconds: 3600,
} as const;
