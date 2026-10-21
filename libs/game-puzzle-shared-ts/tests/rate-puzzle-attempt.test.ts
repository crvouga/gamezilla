/**
 * §8 `ratePuzzleAttempt` against real SQL: the same invariants the sync
 * engine relies on when it replays a batch — applied twice, out of order, or
 * with a second attempt on a puzzle that already moved the rating.
 */
import { describe, expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/rate-puzzle-attempt-mutation';
import {
  applyPuzzleAttemptRating,
  DEFAULT_PUZZLE_RATING_STATE,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/game-puzzle-shared-ts/rating';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';

const OWNER = 'user_1';

function env(atMs: number): MutationEnv {
  return {
    actorId: OWNER,
    deviceId: 'device_1',
    accountId: OWNER,
    isAnon: false,
    now: () => new Date(atMs),
    createId: () => 'unused',
  };
}

/**
 * With the permission tables: a rated result checks the owner's daily puzzle
 * allowance, which for this signed-in owner is unlimited (no start charge).
 */
async function openDb(): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables(uniqueTables([...BILLING_TABLES, ...PUZZLE_TABLES])),
    {
      ownership: 'declared-only',
    }
  );
  return db;
}

type Attempt = {
  readonly attemptKey: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: 'solved' | 'failed' | 'abandoned';
  readonly scorePermille: number;
  readonly atMs: number;
};

async function rate(db: SqlClient, attempt: Attempt): Promise<void> {
  const args = {
    attemptKey: attempt.attemptKey,
    solveIdx: 3,
    ownerId: OWNER,
    puzzleId: attempt.puzzleId,
    puzzleRating: attempt.puzzleRating,
    puzzleRatingDeviation: 80,
    outcome: attempt.outcome,
    scorePermille: attempt.scorePermille,
  };
  const parsed =
    await ratePuzzleAttemptMutation.args['~standard'].validate(args);
  if (parsed.issues !== undefined) {
    throw new Error(`invalid args: ${JSON.stringify(parsed.issues)}`);
  }
  await ratePuzzleAttemptMutation.run(
    { tx: db, env: env(attempt.atMs) },
    parsed.value
  );
}

function readProfile(db: SqlClient) {
  return db.query(sql<{
    readonly rating: number;
    readonly rating_deviation: number;
    readonly volatility_micros: number;
  }>`
    SELECT rating, rating_deviation, volatility_micros
    FROM chess_puzzle_profiles
    WHERE owner_id = ${OWNER}
  `);
}

function readEvents(db: SqlClient) {
  return db.query(sql<{
    readonly puzzle_id: string;
    readonly outcome: string;
    readonly rating_before: number;
    readonly rating_after: number;
  }>`
    SELECT puzzle_id, outcome, rating_before, rating_after
    FROM chess_puzzle_rating_events
    WHERE owner_id = ${OWNER}
    ORDER BY at ASC, puzzle_id ASC
  `);
}

const SOLVED_P1: Attempt = {
  attemptKey: 'first-p1',
  puzzleId: 'p1',
  puzzleRating: 1500,
  outcome: 'solved',
  scorePermille: PUZZLE_SCORE_PERMILLE.win,
  atMs: 1_700_000_000_000,
};

describe('§8 ratePuzzleAttempt', () => {
  test('the first attempt seeds the profile from the 1500 default', async () => {
    const db = await openDb();
    await rate(db, SOLVED_P1);

    const expected = applyPuzzleAttemptRating({
      player: DEFAULT_PUZZLE_RATING_STATE,
      puzzleRating: SOLVED_P1.puzzleRating,
      puzzleRatingDeviation: 80,
      scorePermille: PUZZLE_SCORE_PERMILLE.win,
    });
    expect(await readProfile(db)).toEqual([
      {
        rating: expected.rating,
        rating_deviation: expected.ratingDeviation,
        volatility_micros: expected.volatilityMicros,
      },
    ]);
    const events = await readEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      puzzle_id: 'p1',
      outcome: 'solved',
      rating_before: DEFAULT_PUZZLE_RATING_STATE.rating,
      rating_after: expected.rating,
    });
  });

  test('a duplicated replay of the same attempt changes nothing', async () => {
    const db = await openDb();
    await rate(db, SOLVED_P1);
    const afterFirst = await readProfile(db);
    await rate(db, SOLVED_P1);
    await rate(db, { ...SOLVED_P1, atMs: SOLVED_P1.atMs + 60_000 });

    expect(await readProfile(db)).toEqual(afterFirst);
    expect(await readEvents(db)).toHaveLength(1);
  });

  test('a second attempt on the same puzzle never re-rates it', async () => {
    const db = await openDb();
    await rate(db, SOLVED_P1);
    const afterFirst = await readProfile(db);
    await rate(db, {
      ...SOLVED_P1,
      attemptKey: 'second-p1',
      outcome: 'failed',
      scorePermille: PUZZLE_SCORE_PERMILLE.loss,
      atMs: SOLVED_P1.atMs + 86_400_000,
    });

    expect(await readProfile(db)).toEqual(afterFirst);
    const events = await readEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('solved');
  });

  test('two devices finishing one attempt differently count the first to arrive, once', async () => {
    for (const [first, second] of [
      ['solved', 'failed'],
      ['failed', 'solved'],
    ] as const) {
      const db = await openDb();
      const score = (outcome: 'solved' | 'failed') =>
        outcome === 'solved'
          ? PUZZLE_SCORE_PERMILLE.win
          : PUZZLE_SCORE_PERMILLE.loss;
      // Each device uploads its own result for the same puzzle; whichever
      // reaches the account first is the one that counts.
      await rate(db, {
        ...SOLVED_P1,
        attemptKey: 'phone-p1',
        outcome: first,
        scorePermille: score(first),
      });
      await rate(db, {
        ...SOLVED_P1,
        attemptKey: 'laptop-p1',
        outcome: second,
        scorePermille: score(second),
        atMs: SOLVED_P1.atMs + 1000,
      });
      const events = await readEvents(db);
      expect(events).toHaveLength(1);
      expect(events[0]?.outcome).toBe(first);
    }
  });

  test('a batch replayed out of order still rates each puzzle exactly once', async () => {
    const forward = await openDb();
    const shuffled = await openDb();
    const batch: readonly Attempt[] = [
      SOLVED_P1,
      {
        attemptKey: 'first-p2',
        puzzleId: 'p2',
        puzzleRating: 1600,
        outcome: 'failed',
        scorePermille: PUZZLE_SCORE_PERMILLE.loss,
        atMs: SOLVED_P1.atMs + 1000,
      },
      {
        attemptKey: 'first-p3',
        puzzleId: 'p3',
        puzzleRating: 1400,
        outcome: 'solved',
        scorePermille: PUZZLE_SCORE_PERMILLE.win,
        atMs: SOLVED_P1.atMs + 2000,
      },
    ];
    for (const attempt of batch) await rate(forward, attempt);
    // Replayed backwards, then the whole batch again (at-least-once upload).
    for (const attempt of [...batch].reverse()) await rate(shuffled, attempt);
    for (const attempt of batch) await rate(shuffled, attempt);

    expect(await readEvents(forward)).toHaveLength(3);
    expect(await readEvents(shuffled)).toHaveLength(3);
    // Order changes the arithmetic, but never how many times a puzzle counts.
    for (const db of [forward, shuffled]) {
      const puzzleIds = (await readEvents(db)).map((row) => row.puzzle_id);
      expect(new Set(puzzleIds).size).toBe(3);
    }
  });

  test('a rating for someone else is rejected', async () => {
    const db = await openDb();
    await expect(
      ratePuzzleAttemptMutation.run(
        {
          tx: db,
          env: { ...env(SOLVED_P1.atMs), actorId: 'someone_else' },
        },
        {
          attemptKey: 'first-p1',
          solveIdx: 3,
          ownerId: OWNER,
          puzzleId: 'p1',
          puzzleRating: 1500,
          puzzleRatingDeviation: 80,
          outcome: 'solved',
          scorePermille: PUZZLE_SCORE_PERMILLE.win,
        }
      )
    ).rejects.toThrow(/only update your own/);
  });

  test('a contradictory result cannot award credit its outcome excludes', async () => {
    // regression: puzzle-inconsistent-result-score
    const db = await openDb();
    try {
      for (const result of [
        { outcome: 'failed', scorePermille: 1000 },
        { outcome: 'solved', scorePermille: 0 },
        { outcome: 'abandoned', scorePermille: 500 },
      ] as const) {
        await expect(
          ratePuzzleAttemptMutation.run(
            { tx: db, env: env(SOLVED_P1.atMs) },
            {
              attemptKey: 'first-p1',
              solveIdx: 3,
              ownerId: OWNER,
              puzzleId: 'p1',
              puzzleRating: 1500,
              puzzleRatingDeviation: 80,
              ...result,
            }
          )
        ).rejects.toThrow('A puzzle attempt scores');
      }
      expect(await readEvents(db)).toEqual([]);
      expect(
        await db.query(
          sql<{ id: string }>`SELECT id FROM chess_puzzle_interactions`
        )
      ).toEqual([]);
    } finally {
      await db.disconnect();
    }
  });
});
