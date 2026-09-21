/**
 * §8 `ratePuzzleAttempt` against real SQL: the same invariants the sync
 * engine relies on when it replays a batch — applied twice, out of order, or
 * with a second attempt on a puzzle that already moved the rating.
 */
import { describe, expect, test } from 'bun:test';

import {
  applyPuzzleAttemptRating,
  DEFAULT_PUZZLE_RATING_STATE,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/chess/public/chess-puzzle-rating';
import { CHESS_TABLES } from '@libs/chess/public/schema';
import {
  ratePuzzleAttemptMutation,
  upsertPuzzleProfileMutation,
} from '@libs/chess/root/mutations';
import { registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import type { MutationEnv } from '@pkgs/sync-engine/shared';

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

async function openDb(): Promise<SqlClient> {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await applySqliteSchema(db, registerTables([...CHESS_TABLES]), {
    ownership: 'declared-only',
  });
  return db;
}

type Attempt = {
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: 'solved' | 'failed' | 'abandoned';
  readonly scorePermille: number;
  readonly atMs: number;
};

async function rate(db: SqlClient, attempt: Attempt): Promise<void> {
  const args = {
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
      outcome: 'failed',
      scorePermille: PUZZLE_SCORE_PERMILLE.loss,
      atMs: SOLVED_P1.atMs + 86_400_000,
    });

    expect(await readProfile(db)).toEqual(afterFirst);
    const events = await readEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('solved');
  });

  test('a batch replayed out of order still rates each puzzle exactly once', async () => {
    const forward = await openDb();
    const shuffled = await openDb();
    const batch: readonly Attempt[] = [
      SOLVED_P1,
      {
        puzzleId: 'p2',
        puzzleRating: 1600,
        outcome: 'failed',
        scorePermille: PUZZLE_SCORE_PERMILLE.loss,
        atMs: SOLVED_P1.atMs + 1000,
      },
      {
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
});

/**
 * The pre-§8 wire name stays registered so an old client's queued write is not
 * dropped (contract names are append-only), but it can no longer set a rating.
 */
describe('upsertPuzzleProfile (frozen wire name)', () => {
  async function legacyUpsert(
    db: SqlClient,
    args: {
      ownerId: string;
      rating: number;
      ratingDeviation: number;
      lastInteractionAt?: string;
    }
  ): Promise<void> {
    const parsed =
      await upsertPuzzleProfileMutation.args['~standard'].validate(args);
    if (parsed.issues !== undefined) {
      throw new Error(`invalid args: ${JSON.stringify(parsed.issues)}`);
    }
    await upsertPuzzleProfileMutation.run(
      { tx: db, env: env(1_700_000_000_000) },
      parsed.value
    );
  }

  test('records activity and ignores the rating the client sent', async () => {
    const db = await openDb();
    await rate(db, SOLVED_P1);
    const before = (await readProfile(db))[0];
    await legacyUpsert(db, {
      ownerId: OWNER,
      rating: 2800,
      ratingDeviation: 10,
      lastInteractionAt: '2026-09-19T00:00:00.000Z',
    });
    const after = (await readProfile(db))[0];
    expect(after?.rating).toBe(before?.rating as number);
    expect(after?.rating_deviation).toBe(before?.rating_deviation as number);
    const activity = await db.query(sql<{
      readonly last_interaction_at: string;
    }>`
      SELECT last_interaction_at FROM chess_puzzle_profiles
      WHERE owner_id = ${OWNER}
    `);
    expect(activity[0]?.last_interaction_at).toBe('2026-09-19T00:00:00.000Z');
  });

  test('refuses to write another owner', async () => {
    const db = await openDb();
    await rate(db, SOLVED_P1);
    await expect(
      legacyUpsert(db, {
        ownerId: 'someone_else',
        rating: 1600,
        ratingDeviation: 100,
      })
    ).rejects.toThrow(/only update your own/i);
  });
});
