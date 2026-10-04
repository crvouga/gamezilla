import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { z } from 'zod';
import {
  PUZZLE_POOL_BAND_ROW_LIMIT,
  PUZZLE_POOL_RATING_CEILING,
} from './chess-puzzle-feed-config';
import { chessPuzzlesChannels } from '@libs/chess-shared/sync-topics';

export const chessPuzzlePool = defineQuery({
  name: 'chessPuzzlePool',
  params: z
    .object({
      ratingMin: z
        .number()
        .int()
        .min(0)
        .max(PUZZLE_POOL_RATING_CEILING)
        .default(0),
      ratingMax: z
        .number()
        .int()
        .min(0)
        .max(PUZZLE_POOL_RATING_CEILING)
        .default(PUZZLE_POOL_RATING_CEILING),
    })
    .refine((p) => p.ratingMin <= p.ratingMax),
  sampleParams: { ratingMin: 0, ratingMax: PUZZLE_POOL_RATING_CEILING },
  limit: PUZZLE_POOL_BAND_ROW_LIMIT,
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
      ORDER BY popularity DESC, nb_plays DESC, id ASC
`);
    return { chess_puzzles: rows };
  },
});
