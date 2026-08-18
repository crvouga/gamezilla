import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const upsertPuzzleProfileMutation = defineMutation({
  name: 'upsertPuzzleProfile',
  args: z.object({
    ownerId: z.string().min(1),
    rating: z.number().int().nonnegative(),
    ratingDeviation: z.number().int().nonnegative(),
    lastInteractionAt: z.string().min(1).optional(),
  }),
  async run({ tx, env }, args) {
    if (args.ownerId !== env.actorId) {
      throw new MutationError(
        'CHESS_WRITE_DENIED',
        'You can only update your own puzzle activity.'
      );
    }
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
