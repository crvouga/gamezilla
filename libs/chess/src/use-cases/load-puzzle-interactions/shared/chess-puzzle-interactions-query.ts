import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const chessPuzzleInteractions = defineQuery({
  name: 'chessPuzzleInteractions',
  limit: 5000,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, 
        owner_id, 
        puzzle_id, 
        puzzle_rating, 
        kind, 
        solve_idx,
        uci, 
        correct, 
        rating_before, 
        rating_after, 
        at,
        deleted_at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${ctx.env.actorId}
`);
    return { chess_puzzle_interactions: rows };
  },
});
