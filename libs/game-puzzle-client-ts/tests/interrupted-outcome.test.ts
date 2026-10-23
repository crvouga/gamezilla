import { expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { PuzzleInteractionDb } from '@libs/game-puzzle-client-ts/puzzle-interaction-db';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';

test('a failed result write leaves no half-finished attempt and retry counts once', async () => {
  // regression: puzzle-outcome-recorded-rating-lost
  // regression: puzzle-result-queued-without-rating
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables(uniqueTables([...BILLING_TABLES, ...PUZZLE_TABLES])),
    { ownership: 'declared-only' }
  );
  let id = 0;
  let interrupt: 'before' | 'inside' | 'none' = 'before';
  const createId = () => `interaction-${String(++id)}`;
  const env = {
    actorId: 'alice',
    deviceId: 'phone',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date(1_700_000_000_000 + id),
    createId,
  };
  const client: MutationClient = {
    query: db.query.bind(db),
    drain: () => Promise.resolve(),
    mutate: async (mutation, args) => {
      if (mutation.name === 'ratePuzzleAttempt' && interrupt === 'before') {
        interrupt = 'inside';
        throw new Error('interrupted before rating');
      }
      await db.transaction((tx) =>
        mutation.run(
          {
            env,
            tx: {
              query: tx.query.bind(tx),
              run: async (query) => {
                if (
                  interrupt === 'inside' &&
                  query.sql.includes('INTO chess_puzzle_profiles')
                ) {
                  interrupt = 'none';
                  throw new Error('interrupted while writing profile');
                }
                return tx.run(query);
              },
            },
          },
          args
        )
      );
      return { ok: true, mutationId: createId() };
    },
  };
  const recorder = new PuzzleInteractionDb(client, createId);
  const attempt = {
    attemptKey: 'puzzle-one|1700000000000',
    ownerId: 'alice',
    puzzleId: 'puzzle-one',
    puzzleRating: 1500,
    puzzleRatingDeviation: 80,
    solveIdx: 3,
    terminalKind: 'solved' as const,
    scorePermille: 1000 as const,
  };
  try {
    await recorder.appendRow({ ...attempt, kind: 'started' });
    const rows = () =>
      db.query(sql<PuzzleInteractionRow>`
      SELECT puzzle_id AS puzzleId, puzzle_rating AS puzzleRating,
        kind, solve_idx AS solveIdx, uci, correct, at
      FROM chess_puzzle_interactions ORDER BY at ASC, id ASC
    `);
    await expect(recorder.finalizeRatedAttempt(attempt)).rejects.toThrow(
      'interrupted before rating'
    );
    expect((await rows()).map((row) => row.kind)).toEqual(['started']);
    await expect(recorder.finalizeRatedAttempt(attempt)).rejects.toThrow(
      'interrupted while writing profile'
    );
    expect((await rows()).map((row) => row.kind)).toEqual(['started']);
    expect(
      await db.query(
        sql<{ id: string }>`SELECT id FROM chess_puzzle_rating_events`
      )
    ).toEqual([]);
    expect(
      await db.query(sql<{ id: string }>`SELECT id FROM chess_puzzle_profiles`)
    ).toEqual([]);
    await recorder.finalizeRatedAttempt(attempt);
    await recorder.finalizeRatedAttempt(attempt);
    expect((await rows()).map((row) => row.kind)).toEqual([
      'started',
      'solved',
    ]);
    expect(
      await db.query(sql<{
        readonly outcome: string;
        readonly score_permille: number;
      }>`
      SELECT outcome, score_permille FROM chess_puzzle_rating_events
    `)
    ).toEqual([{ outcome: 'solved', score_permille: 1000 }]);
  } finally {
    await db.disconnect();
  }
});
