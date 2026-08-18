import { chessPuzzlesChannels } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const chessPuzzlePool = defineQuery({
  name: 'chessPuzzlePool',
  params: z
    .object({
      ratingMin: z.number().int().min(0).max(4000).default(0),
      ratingMax: z.number().int().min(0).max(4000).default(4000),
    })
    .refine((p) => p.ratingMin <= p.ratingMax),
  limit: 5000,
  entryChannel: () => chessPuzzlesChannels(),
  async run(ctx, { ratingMin, ratingMax }) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, 
        fen, 
        moves, 
        rating, 
        rating_deviation, 
        popularity,
        nb_plays, 
        themes, 
        game_url, 
        opening_tags,
        deleted_at
      FROM chess_puzzles
      WHERE rating >= ${ratingMin}
        AND rating <= ${ratingMax}
      ORDER BY popularity DESC
`);
    return { chess_puzzles: rows };
  },
});
