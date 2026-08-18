import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const chessPuzzleProfile = defineQuery({
  name: 'chessPuzzleProfile',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        owner_id,
        rating,
        rating_deviation,
        last_interaction_at,
        deleted_at
      FROM chess_puzzle_profiles
      WHERE owner_id = ${ctx.env.actorId}
`);
    return { chess_puzzle_profiles: rows };
  },
});
