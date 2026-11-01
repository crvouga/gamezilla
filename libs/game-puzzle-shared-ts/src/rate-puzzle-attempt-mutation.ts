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
 *
 * The daily puzzle limit is charged when a rated puzzle starts (the
 * `consumeQuota` the start gate sends first, replayed before this one), so a
 * new rated result needs that charge: a device that skips or loses the start
 * cannot record results past the limit. A charge on any day counts, so a
 * puzzle started before midnight or before the app closed still finishes.
 */

import { requireChargedInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { ACTION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { PUZZLE_POOL_RATING_CEILING } from './feed-config';
import { PUZZLE_INTERACTION_KIND } from './interaction-entities';
import { nextPuzzleInteractionActivity } from './puzzle-interaction-activity';
import { puzzleNamespaceOf, puzzleOwnerKey } from './puzzle-namespace';
import { ratedStartKeyPrefix } from './rated-start-key';
import type { PuzzleRatingState } from './rating';
import {
  applyPuzzleAttemptRating,
  isPuzzleScorePermille,
  readPuzzleRatingState,
} from './rating';
import { puzzleRatingEventId } from './rating-event';

const ratePuzzleAttemptArgs = z.object({
  attemptKey: z.string().min(1),
  solveIdx: z.number().int().nonnegative(),
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
    PUZZLE_INTERACTION_KIND.solved,
    PUZZLE_INTERACTION_KIND.failed,
    PUZZLE_INTERACTION_KIND.abandoned,
  ]),
  scorePermille: z.number().int().min(0).max(1000),
});

type RatePuzzleAttemptArgs = z.infer<typeof ratePuzzleAttemptArgs>;

type ProfileSqlRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
  readonly volatility_micros: number | null;
};

/** The player's rating profile for the game the puzzle is from. */
type ProfileKey = { readonly id: string; readonly ownerId: string };

async function readProfile(
  tx: MutationDb,
  profile: ProfileKey
): Promise<{ exists: boolean; state: PuzzleRatingState }> {
  const rows = await tx.query(sql<ProfileSqlRow>`
    SELECT rating, rating_deviation, volatility_micros
    FROM chess_puzzle_profiles
    WHERE id = ${profile.id}
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

async function recordOutcome(
  tx: MutationDb,
  args: RatePuzzleAttemptArgs,
  at: string
): Promise<void> {
  const id = `${args.ownerId}|${args.attemptKey}`;
  const rows = await tx.query(sql<{ puzzle_id: string; kind: string }>`
    SELECT puzzle_id, kind FROM chess_puzzle_interactions WHERE id = ${id}
  `);
  if (rows[0] !== undefined) {
    if (rows[0].puzzle_id !== args.puzzleId || rows[0].kind !== args.outcome)
      throw new MutationError(
        'CHESS_ATTEMPT_ALREADY_FINISHED',
        'The attempt already has its first result.'
      );
    return;
  }
  await tx.run(sql`
    INSERT INTO chess_puzzle_interactions (
      id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, at, activity_order
    ) VALUES (
      ${id}, ${args.ownerId}, ${args.puzzleId}, ${args.puzzleRating},
      ${args.outcome}, ${args.solveIdx}, ${at}, ${await nextPuzzleInteractionActivity(tx, args.ownerId)}
    ) ON CONFLICT (id) DO NOTHING
  `);
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
      ${puzzleRatingEventId(args.ownerId, args.puzzleId)},
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
  profile: ProfileKey,
  next: {
    state: PuzzleRatingState;
    before: PuzzleRatingState;
    at: string;
    exists: boolean;
  }
): Promise<void> {
  if (next.exists) {
    // Two results can read one profile before either commits. Matching that
    // read makes the later update miss, so the attempt is retried.
    const written = await tx.query(sql<{ readonly id: string }>`
      UPDATE chess_puzzle_profiles
      SET rating = ${next.state.rating},
          rating_deviation = ${next.state.ratingDeviation},
          volatility_micros = ${next.state.volatilityMicros},
          last_interaction_at = ${next.at}
      WHERE id = ${profile.id}
        AND deleted_at IS NULL
        AND rating = ${next.before.rating}
        AND rating_deviation = ${next.before.ratingDeviation}
        AND volatility_micros = ${next.before.volatilityMicros}
      RETURNING id
    `);
    if (written.length !== 1) {
      throw new Error('Puzzle rating changed while this result was recorded.');
    }
    return;
  }
  await tx.run(sql`
    INSERT INTO chess_puzzle_profiles (
      id, owner_id, rating, rating_deviation, volatility_micros,
      last_interaction_at
    )
    VALUES (
      ${profile.id}, ${profile.ownerId}, ${next.state.rating},
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
    if (
      !isPuzzleScorePermille(args.scorePermille) ||
      (args.outcome === 'solved' && args.scorePermille === 0) ||
      (args.outcome === 'failed' && args.scorePermille === 1000) ||
      (args.outcome === 'abandoned' && args.scorePermille !== 0)
    ) {
      throw new MutationError(
        'CHESS_RATING_SCORE_INVALID',
        'A puzzle attempt scores 0, 500 or 1000 permille.'
      );
    }
    const eventId = puzzleRatingEventId(args.ownerId, args.puzzleId);
    const rated = await alreadyRated(tx, eventId);
    if (!rated)
      await requireChargedInMutation(
        { tx, env },
        {
          quota: ACTION.puzzleRatedSolve,
          keyPrefix: ratedStartKeyPrefix(args.puzzleId),
        }
      );
    const at = env.now().toISOString();
    // Result, first rating, and queued upload share the mutation transaction.
    await recordOutcome(tx, args, at);
    if (rated) return;
    // Each game rates its puzzles apart: the profile in the puzzle's
    // namespace (the durable game's is the owner's id itself).
    const key: ProfileKey = {
      id: puzzleOwnerKey(puzzleNamespaceOf(args.puzzleId), args.ownerId),
      ownerId: args.ownerId,
    };
    const profile = await readProfile(tx, key);
    const after = applyPuzzleAttemptRating({
      player: profile.state,
      puzzleRating: args.puzzleRating,
      puzzleRatingDeviation: args.puzzleRatingDeviation,
      scorePermille: args.scorePermille,
    });
    await insertRatingEvent(tx, args, {
      before: profile.state,
      after,
      at,
    });
    await writeProfile(tx, key, {
      state: after,
      before: profile.state,
      at,
      exists: profile.exists,
    });
  },
});
