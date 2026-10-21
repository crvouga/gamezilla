/**
 * The puzzle profile other devices receive is the whole rating state:
 * rating, deviation and volatility. A device that got only part of it would
 * rate its next puzzle from a different state than the device that earned it.
 */
import { expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { chessPuzzleProfile } from '@libs/game-puzzle-shared-ts/profile-query';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/rate-puzzle-attempt-mutation';
import {
  applyPuzzleAttemptRating,
  DEFAULT_PUZZLE_RATING_STATE,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/game-puzzle-shared-ts/rating';
import { PUZZLE_QUERIES } from '@libs/game-puzzle-shared-ts/sub';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

const OWNER = 'user_1';
const AT = new Date(1_700_000_000_000);
const PUZZLE_RATING = 1500;
const PUZZLE_RD = 80;

const env = {
  actorId: OWNER,
  deviceId: 'device_1',
  accountId: OWNER,
  isAnon: false,
  now: () => AT,
  createId: () => 'unused',
};

// regression: puzzle-profile-volatility-sync
test('the synced puzzle profile carries rating, deviation and volatility', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables(uniqueTables([...BILLING_TABLES, ...PUZZLE_TABLES])),
    {
      ownership: 'declared-only',
    }
  );
  const parsed = await ratePuzzleAttemptMutation.args['~standard'].validate({
    attemptKey: 'first-p1',
    solveIdx: 3,
    ownerId: OWNER,
    puzzleId: 'p1',
    puzzleRating: PUZZLE_RATING,
    puzzleRatingDeviation: PUZZLE_RD,
    outcome: 'solved',
    scorePermille: PUZZLE_SCORE_PERMILLE.win,
  });
  if (parsed.issues !== undefined) throw new Error('invalid rating args');
  await ratePuzzleAttemptMutation.run({ tx: db, env }, parsed.value);

  const query = chessPuzzleProfile;
  expect(PUZZLE_QUERIES).toContain(query);
  expect(query.name).toBe('chessPuzzleProfile');
  const tables = await query.run(
    { db: { query: (q) => db.query(q as Sql<QueryRow>) }, env },
    {}
  );
  const expected = applyPuzzleAttemptRating({
    player: DEFAULT_PUZZLE_RATING_STATE,
    puzzleRating: PUZZLE_RATING,
    puzzleRatingDeviation: PUZZLE_RD,
    scorePermille: PUZZLE_SCORE_PERMILLE.win,
  });
  expect(tables['chess_puzzle_profiles']).toEqual([
    expect.objectContaining({
      owner_id: OWNER,
      rating: expected.rating,
      rating_deviation: expected.ratingDeviation,
      volatility_micros: expected.volatilityMicros,
    }),
  ]);
});
