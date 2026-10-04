import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

import { CHESS_PUZZLE_INTERACTION_KIND } from './chess-puzzle-interaction-entities';

const interactionArgs = z.object({
  interactionId: z.string().min(1),
  ownerId: z.string().min(1),
  puzzleId: z.string().min(1),
  puzzleRating: z.number().int().nonnegative(),
  kind: z.enum(CHESS_PUZZLE_INTERACTION_KIND),
  solveIdx: z.number().int().nonnegative(),
  uci: z.string().nullable().optional(),
  correct: z.boolean().nullable().optional(),
});

export const appendPuzzleInteractionMutation = defineMutation({
  name: 'appendPuzzleInteraction',
  args: interactionArgs,
  async run({ tx, env }, args) {
    if (args.ownerId !== env.actorId) {
      throw new MutationError(
        'CHESS_WRITE_DENIED',
        'You can only update your own puzzle activity.'
      );
    }
    await tx.run(sql`
      INSERT INTO chess_puzzle_interactions (
        id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, uci, correct,
        at
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
        ${env.now().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  },
});
