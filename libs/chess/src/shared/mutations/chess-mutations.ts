import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
} from '@libs/db/shared/chess-tables';
import { defineMutation } from '@pkgs/sync-engine/mutations/core/define-mutation';
import { MutationError } from '@pkgs/sync-engine/mutations/core/types';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

import { CHESS_PUZZLE_INTERACTION_KIND } from '../chess-puzzle-interaction-entities';

const interactionArgs = z.object({
  interactionId: z.string().min(1),
  ownerId: z.string().min(1),
  puzzleId: z.string().min(1),
  puzzleRating: z.number().int().nonnegative(),
  kind: z.enum(CHESS_PUZZLE_INTERACTION_KIND),
  solveIdx: z.number().int().nonnegative(),
  uci: z.string().nullable().optional(),
  correct: z.boolean().nullable().optional(),
  ratingBefore: z.number().int().nonnegative().optional(),
  ratingAfter: z.number().int().nonnegative().optional(),
});

function requireOwner(ownerId: string, actorId: string): void {
  if (ownerId !== actorId) {
    throw new MutationError(
      'CHESS_WRITE_DENIED',
      'You can only update your own puzzle activity.'
    );
  }
}

export const appendPuzzleInteractionMutation = defineMutation({
  name: 'appendPuzzleInteraction',
  args: interactionArgs,
  writes: [CHESS_PUZZLE_INTERACTIONS_TABLE.tableName],
  async run({ tx, env }, args) {
    requireOwner(args.ownerId, env.actorId);
    await tx.run(sql`
      INSERT INTO chess_puzzle_interactions (
        id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, uci, correct,
        rating_before, rating_after, at
      )
      VALUES (
        ${args.interactionId}, ${args.ownerId}, ${args.puzzleId},
        ${args.puzzleRating}, ${args.kind}, ${args.solveIdx},
        ${args.uci ?? null},
        ${
          args.correct === undefined || args.correct === null
            ? null
            : args.correct
              ? 1
              : 0
        },
        ${args.ratingBefore ?? 0}, ${args.ratingAfter ?? 0},
        ${env.now().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  },
});

export const upsertPuzzleProfileMutation = defineMutation({
  name: 'upsertPuzzleProfile',
  args: z.object({
    ownerId: z.string().min(1),
    rating: z.number().int().nonnegative(),
    ratingDeviation: z.number().int().nonnegative(),
    lastInteractionAt: z.string().min(1).optional(),
  }),
  writes: [CHESS_PUZZLE_PROFILES_TABLE.tableName],
  async run({ tx, env }, args) {
    requireOwner(args.ownerId, env.actorId);
    await tx.run(sql`
      INSERT INTO chess_puzzle_profiles (
        id, owner_id, rating, rating_deviation, last_interaction_at
      )
      VALUES (
        ${args.ownerId}, ${args.ownerId}, ${args.rating},
        ${args.ratingDeviation},
        ${args.lastInteractionAt ?? env.now().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        rating = excluded.rating,
        rating_deviation = excluded.rating_deviation,
        last_interaction_at = excluded.last_interaction_at
    `);
  },
});

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  upsertPuzzleProfileMutation,
] as const;
