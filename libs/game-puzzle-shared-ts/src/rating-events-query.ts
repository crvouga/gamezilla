import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

/** §8 rating history for the signed-in player (one row per rated puzzle). */
export const chessPuzzleRatingEvents = defineQuery({
  name: 'chessPuzzleRatingEvents',
  limit: 5000,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        owner_id,
        puzzle_id,
        puzzle_rating,
        outcome,
        score_permille,
        rating_before,
        rating_after,
        rating_deviation_before,
        rating_deviation_after,
        volatility_micros_after,
        at,
        deleted_at
      FROM chess_puzzle_rating_events
      WHERE owner_id = ${ctx.env.actorId}
      ORDER BY at DESC, id ASC
`);
    return { chess_puzzle_rating_events: rows };
  },
});
