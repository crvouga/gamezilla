import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const chessPuzzleProfile = defineQuery({
  name: 'chessPuzzleProfile',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        owner_id,
        rating,
        rating_deviation,
        volatility_micros,
        last_interaction_at,
        deleted_at
      FROM chess_puzzle_profiles
      WHERE owner_id = ${ctx.env.actorId}
`);
    return { chess_puzzle_profiles: rows };
  },
});
