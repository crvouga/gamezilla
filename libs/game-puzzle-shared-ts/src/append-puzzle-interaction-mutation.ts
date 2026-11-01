import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';

import { PUZZLE_INTERACTION_KIND } from './interaction-entities';
import { nextPuzzleInteractionActivity } from './puzzle-interaction-activity';
import { puzzleAttemptedEvent, puzzleCompletedEvent } from './telemetry';

const interactionArgs = z.object({
  interactionId: z.string().min(1),
  ownerId: z.string().min(1),
  puzzleId: z.string().min(1),
  puzzleRating: z.number().int().nonnegative(),
  kind: z.enum(PUZZLE_INTERACTION_KIND),
  solveIdx: z.number().int().nonnegative(),
  uci: z.string().nullable().optional(),
  correct: z.boolean().nullable().optional(),
});

export type AppendPuzzleInteractionInput = Omit<
  z.infer<typeof interactionArgs>,
  'interactionId'
>;

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
        at, activity_order
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
        ${env.now().toISOString()}, ${await nextPuzzleInteractionActivity(tx, args.ownerId)}
      )
      ON CONFLICT (id) DO NOTHING
    `);
    const event =
      args.kind === PUZZLE_INTERACTION_KIND.started
        ? puzzleAttemptedEvent
        : args.kind === PUZZLE_INTERACTION_KIND.solved
          ? puzzleCompletedEvent
          : undefined;
    if (event !== undefined)
      await event.record(
        { tx, env },
        {
          id: `${args.ownerId}:${args.puzzleId}:${args.solveIdx}:${args.kind}`,
          attributes: { 'puzzle.id': args.puzzleId, 'subject.id': env.actorId },
        }
      );
  },
});
