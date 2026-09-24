/**
 * §8 server-authoritative rating. The client sends the *attempt* (which
 * puzzle, what happened), never a rating: the new profile row is derived
 * inside the mutation transaction from the stored profile plus the puzzle's
 * rating, so the same definition produces the optimistic local value and the
 * authoritative one on replay — and the engine rebases the client onto the
 * server's.
 *
 * "Repeat attempts never affect rating" is one mechanism, not a UI rule: the
 * rating ledger row is keyed `<ownerId>|<puzzleId>`, so a second attempt, a
 * duplicated upload and an out-of-order replay all find the row already
 * there and leave the rating alone. That is also what makes an
 * exhausted-pool re-serve unrated (§9).
 */

import { sql } from '@pkgs/sql';
import type { MutationDb } from '@pkgs/sync-engine/shared';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { PUZZLE_POOL_RATING_CEILING } from '../../../shared/chess/chess-puzzle-feed-config';
import { CHESS_PUZZLE_INTERACTION_KIND } from '../../../shared/chess/chess-puzzle-interaction-entities';
import {
  applyPuzzleAttemptRating,
  isPuzzleScorePermille,
  type PuzzleRatingState,
  readPuzzleRatingState,
} from '../../../shared/chess/chess-puzzle-rating';
import { chessPuzzleRatingEventId } from '../../../shared/chess/chess-puzzle-rating-event';

const ratePuzzleAttemptArgs = z.object({
  ownerId: z.string().min(1),
  puzzleId: z.string().min(1),
  // The catalog's own range, not the player's: `applyPuzzleAttemptRating`
  // clamps the opponent into the rating scale itself.
  puzzleRating: z.number().int().nonnegative().max(PUZZLE_POOL_RATING_CEILING),
  puzzleRatingDeviation: z
    .number()
    .int()
    .nonnegative()
    .max(PUZZLE_POOL_RATING_CEILING),
  outcome: z.enum([
    CHESS_PUZZLE_INTERACTION_KIND.solved,
    CHESS_PUZZLE_INTERACTION_KIND.failed,
    CHESS_PUZZLE_INTERACTION_KIND.abandoned,
  ]),
  scorePermille: z.number().int().min(0).max(1000),
});

type RatePuzzleAttemptArgs = z.infer<typeof ratePuzzleAttemptArgs>;

type ProfileSqlRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
  readonly volatility_micros: number | null;
};

async function readProfile(
  tx: MutationDb,
  ownerId: string
): Promise<{ exists: boolean; state: PuzzleRatingState }> {
  const rows = await tx.query(sql<ProfileSqlRow>`
    SELECT rating, rating_deviation, volatility_micros
    FROM chess_puzzle_profiles
    WHERE id = ${ownerId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  return {
    exists: row !== undefined,
    state: readPuzzleRatingState({
      rating: row?.rating,
      ratingDeviation: row?.rating_deviation,
      volatilityMicros: row?.volatility_micros,
    }),
  };
}

async function alreadyRated(tx: MutationDb, eventId: string): Promise<boolean> {
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id
    FROM chess_puzzle_rating_events
    WHERE id = ${eventId}
    LIMIT 1
  `);
  return rows.length > 0;
}

async function insertRatingEvent(
  tx: MutationDb,
  args: RatePuzzleAttemptArgs,
  change: { before: PuzzleRatingState; after: PuzzleRatingState; at: string }
): Promise<void> {
  await tx.run(sql`
    INSERT INTO chess_puzzle_rating_events (
      id, owner_id, puzzle_id, puzzle_rating, outcome, score_permille,
      rating_before, rating_after, rating_deviation_before,
      rating_deviation_after, volatility_micros_after, at
    )
    VALUES (
      ${chessPuzzleRatingEventId(args.ownerId, args.puzzleId)},
      ${args.ownerId}, ${args.puzzleId}, ${args.puzzleRating},
      ${args.outcome}, ${args.scorePermille},
      ${change.before.rating}, ${change.after.rating},
      ${change.before.ratingDeviation}, ${change.after.ratingDeviation},
      ${change.after.volatilityMicros}, ${change.at}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

async function writeProfile(
  tx: MutationDb,
  ownerId: string,
  next: { state: PuzzleRatingState; at: string; exists: boolean }
): Promise<void> {
  if (next.exists) {
    await tx.run(sql`
      UPDATE chess_puzzle_profiles
      SET rating = ${next.state.rating},
          rating_deviation = ${next.state.ratingDeviation},
          volatility_micros = ${next.state.volatilityMicros},
          last_interaction_at = ${next.at}
      WHERE id = ${ownerId}
    `);
    return;
  }
  await tx.run(sql`
    INSERT INTO chess_puzzle_profiles (
      id, owner_id, rating, rating_deviation, volatility_micros,
      last_interaction_at
    )
    VALUES (
      ${ownerId}, ${ownerId}, ${next.state.rating},
      ${next.state.ratingDeviation}, ${next.state.volatilityMicros},
      ${next.at}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

export const ratePuzzleAttemptMutation = defineMutation({
  name: 'ratePuzzleAttempt',
  args: ratePuzzleAttemptArgs,
  async run({ tx, env }, args) {
    if (args.ownerId !== env.actorId) {
      throw new MutationError(
        'CHESS_WRITE_DENIED',
        'You can only update your own puzzle activity.'
      );
    }
    if (!isPuzzleScorePermille(args.scorePermille)) {
      throw new MutationError(
        'CHESS_RATING_SCORE_INVALID',
        'A puzzle attempt scores 0, 500 or 1000 permille.'
      );
    }
    const eventId = chessPuzzleRatingEventId(args.ownerId, args.puzzleId);
    // The ledger row is the whole idempotency story (see the file comment).
    if (await alreadyRated(tx, eventId)) return;
    const profile = await readProfile(tx, args.ownerId);
    const after = applyPuzzleAttemptRating({
      player: profile.state,
      puzzleRating: args.puzzleRating,
      puzzleRatingDeviation: args.puzzleRatingDeviation,
      scorePermille: args.scorePermille,
    });
    const at = env.now().toISOString();
    await insertRatingEvent(tx, args, {
      before: profile.state,
      after,
      at,
    });
    await writeProfile(tx, args.ownerId, {
      state: after,
      at,
      exists: profile.exists,
    });
  },
});
