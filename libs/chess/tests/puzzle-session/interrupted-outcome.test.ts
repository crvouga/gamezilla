import { expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing/public/schema';
import { ChessPuzzleInteractionDb } from '@libs/chess/public/chess-puzzle/chess-puzzle-interaction-db';
import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import { CHESS_TABLES } from '@libs/chess/public/schema';
import { uniqueTables } from '@libs/permissions/root/conformance/world';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import type { MutationClient } from '@pkgs/sync-engine/client';

test('recovery completes a recorded outcome whose rating write was interrupted', async () => {
  // regression: puzzle-outcome-recorded-rating-lost
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables(uniqueTables([...BILLING_TABLES, ...CHESS_TABLES])),
    { ownership: 'declared-only' }
  );
  let id = 0;
  let interrupt = true;
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
      if (mutation.name === 'ratePuzzleAttempt' && interrupt) {
        interrupt = false;
        throw new Error('interrupted before rating');
      }
      await db.transaction((tx) => mutation.run({ tx, env }, args));
      return { ok: true, mutationId: createId() };
    },
  };
  const recorder = new ChessPuzzleInteractionDb(client, createId);
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
      db.query(sql<ChessPuzzleInteractionRow>`
      SELECT puzzle_id AS puzzleId, puzzle_rating AS puzzleRating,
        kind, solve_idx AS solveIdx, uci, correct, at
      FROM chess_puzzle_interactions ORDER BY at ASC, id ASC
    `);
    await expect(
      recorder.finalizeRatedAttempt({ ...attempt, interactions: await rows() })
    ).rejects.toThrow('interrupted before rating');
    await recorder.finalizeRatedAttempt({
      ...attempt,
      interactions: await rows(),
    });
    await recorder.finalizeRatedAttempt({
      ...attempt,
      interactions: await rows(),
    });
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
