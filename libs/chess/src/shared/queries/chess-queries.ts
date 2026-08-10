import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

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

export const chessPuzzlePool = defineQuery({
  name: 'chessPuzzlePool',
  params: z
    .object({
      ratingMin: z.number().int().min(0).max(4000).default(0),
      ratingMax: z.number().int().min(0).max(4000).default(4000),
    })
    .refine((p) => p.ratingMin <= p.ratingMax),
  limit: 5000,
  entryChannel: false,
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

export const CHESS_QUERIES = [
  chessPuzzleProfile,
  chessPuzzleInteractions,
  chessPuzzlePool,
] as const;
