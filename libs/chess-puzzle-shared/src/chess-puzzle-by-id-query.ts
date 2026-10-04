import { chessPuzzlesChannels } from '@libs/chess-root-shared/sync-topics';
import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { z } from 'zod';

/** Hydrates one room-selected puzzle for a watcher outside their feed band. */
export const chessPuzzleById = defineQuery({
  name: 'chessPuzzleById',
  params: z.object({ id: z.string().min(1) }),
  sampleParams: { id: 'id_x' },
  limit: 1,
  entryChannel: () => chessPuzzlesChannels(),
  async run(ctx, { id }) {
    const rows = await ctx.db.query(sql`
      SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays,
             themes, game_url, opening_tags, deleted_at
      FROM chess_puzzles
      WHERE id = ${id}
`);
    return { chess_puzzles: rows };
  },
});
