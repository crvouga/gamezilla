/**
 * Single source of truth for the API's `MatchmakingSchema` and the
 * `MatchmakingTuning` values baked into the PL/pgSQL `matchmaking_tick()`
 * function. Imported by [route.ts](./route.ts) which constructs the
 * request-layer `Matchmaking` and forwards both values to `migrate()`.
 *
 * The schema constant lives here (not inline in `route.ts`) so the
 * fingerprint computed by `migrate()` is stable across reboots — the
 * schema_state row keys on it and rebuilds the table on drift.
 *
 * The tuning constant is the value that gets BAKED into the
 * `matchmaking_tick()` function body by `migrate()`. Changing it
 * requires a re-migrate to re-bake the function.
 */

import type { MatchmakingSchema } from '@gamezilla/matchmaking';

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
 * Tuning baked into the `matchmaking_tick()` PL/pgSQL function by
 * `migrate()`. The request layer never invokes pass or sweep directly
 * (those run inside Postgres via pg_cron) — these values control the
 * server-side drain loop.
 *
 * - `maxPairsPerPass: 500`: bigger than the package default (100) since
 *   the cron tick is the sole caller and we want to amortise round
 *   trips inside one Postgres call.
 * - `maxWaitSeconds: 300`: 5-minute abandonment cutoff; reaped per tick.
 * - `matchedRetentionSeconds: 3600`: matched rows stay queryable for
 *   1h after pairing so the `/status` poll loop can read them.
 */
export const MATCHMAKING_TUNING = {
  maxPairsPerPass: 500,
  maxWaitSeconds: 300,
  matchedRetentionSeconds: 3600,
} as const;
