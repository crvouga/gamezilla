import { puzzleCatalogueChannels } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { z } from 'zod';
import {
  PUZZLE_POOL_BAND_ROW_LIMIT,
  PUZZLE_POOL_NEAREST_ROW_LIMIT,
  PUZZLE_POOL_RATING_CEILING,
} from './feed-config';
import {
  PUZZLE_MIN_PLAYS,
  PUZZLE_MIN_POPULARITY,
} from './next-puzzle-selection';
import {
  isPuzzleNamespace,
  puzzleNamespaceCondition,
} from './puzzle-namespace';

/**
 * Which game's puzzles: its namespace, the durable game's `''` when left
 * out (so a device that never names one reads chess's catalogue as before).
 */
const namespaceParam = z
  .string()
  .refine(isPuzzleNamespace, 'not a puzzle namespace')
  .default('');

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
      namespace: namespaceParam,
    })
    .refine((p) => p.ratingMin <= p.ratingMax),
  sampleParams: {
    ratingMin: 0,
    ratingMax: PUZZLE_POOL_RATING_CEILING,
    namespace: '',
  },
  limit: PUZZLE_POOL_BAND_ROW_LIMIT,
  entryChannel: () => puzzleCatalogueChannels(),
  async run(ctx, { ratingMin, ratingMax, namespace }) {
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
        AND ${puzzleNamespaceCondition(namespace)}
      ORDER BY popularity DESC, nb_plays DESC, id ASC
`);
    return { chess_puzzles: rows };
  },
});

/**
 * §9 the servable puzzles nearest a rating, wherever they sit: what the feed
 * falls back to when the rating bands around the target hold no unplayed
 * puzzle (a target at the rating floor or ceiling of a sparse catalog).
 */
export const chessPuzzleNearest = defineQuery({
  name: 'chessPuzzleNearest',
  params: z.object({
    rating: z.number().int().min(0).max(PUZZLE_POOL_RATING_CEILING).default(0),
    namespace: namespaceParam,
  }),
  sampleParams: { rating: 1500, namespace: '' },
  limit: PUZZLE_POOL_NEAREST_ROW_LIMIT,
  entryChannel: () => puzzleCatalogueChannels(),
  async run(ctx, { rating, namespace }) {
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
      WHERE popularity >= ${PUZZLE_MIN_POPULARITY}
        AND nb_plays >= ${PUZZLE_MIN_PLAYS}
        AND ${puzzleNamespaceCondition(namespace)}
      ORDER BY ABS(rating - ${rating}) ASC, id ASC
`);
    return { chess_puzzles: rows };
  },
});
