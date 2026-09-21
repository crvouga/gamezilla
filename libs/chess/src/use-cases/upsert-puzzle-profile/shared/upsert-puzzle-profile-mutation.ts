/**
 * Frozen wire name, not a deprecated alias.
 *
 * Clients shipped before §8 queue `upsertPuzzleProfile` writes while offline,
 * and contract names are append-only (`apps/server/scripts/check-contract-manifest.ts`):
 * dropping the name would resolve those queued writes to `UNKNOWN_MUTATION`,
 * a permanent rejection whose queue row is then thrown away.
 *
 * What it must NOT do any more is take the client's word for a rating. Under
 * §8 the rating is derived inside `ratePuzzleAttempt` from the stored profile
 * and the puzzle, so the rating and deviation an old client sends are read and
 * discarded; all this applies is the activity timestamp, which is the only
 * part of the old payload the server can still trust. The attempt itself
 * arrives as an ordinary `appendPuzzleInteraction` row from the same client,
 * so nothing is lost by ignoring the numbers here.
 */

import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const upsertPuzzleProfileMutation = defineMutation({
  name: 'upsertPuzzleProfile',
  args: z.object({
    ownerId: z.string().min(1),
    /** Read and discarded: ratings are server-derived (§8). */
    rating: z.number().int().nonnegative(),
    /** Read and discarded: see `rating`. */
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
    const at = args.lastInteractionAt ?? env.now().toISOString();
    await tx.run(sql`
      UPDATE chess_puzzle_profiles
      SET last_interaction_at = ${at}
      WHERE id = ${args.ownerId}
    `);
  },
});
