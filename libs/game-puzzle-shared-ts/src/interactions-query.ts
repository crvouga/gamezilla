import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

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
        at,
        activity_order,
        deleted_at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${ctx.env.actorId}
      ORDER BY at DESC, id ASC
`);
    return { chess_puzzle_interactions: rows };
  },
});
