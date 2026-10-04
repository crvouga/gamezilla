import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

/** The signed-in player's saved feed choices (at most one row). */
export const chessPuzzleFeedSettings = defineQuery({
  name: 'chessPuzzleFeedSettings',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, owner_id, config, deleted_at
      FROM chess_puzzle_feed_settings
      WHERE owner_id = ${ctx.env.actorId}
    `);
    return { chess_puzzle_feed_settings: rows };
  },
});
