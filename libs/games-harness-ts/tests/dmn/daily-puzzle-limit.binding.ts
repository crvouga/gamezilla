/**
 * `specs/games/daily-puzzle-limit.dmn` against the permission system. The
 * daily puzzle limit is one allowance for every game offering puzzles, so
 * the decision and its gating are the platform's, and the rated result is
 * enforced in each game, its earlier starts those of another game:
 *
 * - application decision — the kernel's quota decision for the case's
 *   person (facts from the product's resolver), counting the case's started
 *   puzzles through the product's window and ledger arithmetic;
 * - server enforcement — the rated-puzzle consume replayed against a server
 *   database holding the person's started puzzles on the UTC day boundary
 *   (today's at midnight, earlier ones a millisecond before): allowed adds
 *   one ledger row, refused adds none and says why;
 * - server enforcement of the rated result in each game — the same server,
 *   the person's started puzzles those of another game offering puzzles, and
 *   a rated puzzle of this game played through as a device sends it: the
 *   start's consume, then the rated result (`ratePuzzleAttempt`), both
 *   replayed with the authorize hook. Both must be allowed or both refused;
 *   a refused case must leave no rated result (nor anything else) stored, so
 *   a result recorded past the limit fails the case;
 * - client gating — what the device answers when a rated puzzle is about to
 *   start (`usePermissions().can`), the same started puzzles in its synced
 *   ledger.
 */

import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared-ts/sub';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  RATE_PUZZLE_ATTEMPT,
  ratedPuzzleStartKey,
} from '@libs/game-session-harness-ts/puzzle-fixtures';
import { puzzleNamespaceOfGame } from '@libs/game-session-harness-ts/puzzle-pool';
import { dailyPuzzleLimitClientLayer } from '@libs/permissions-harness-ts/client-layers';
import { dailyPuzzleLimitApplicationLayer } from '@libs/permissions-shared-ts/application';
import { PERMISSIONS_MUTATIONS } from '@libs/permissions-shared-ts/mutations';
import type { CaseInput } from '@libs/permissions-shared-ts/people';
import { identityFor, personOf } from '@libs/permissions-shared-ts/people';
import { ACTION } from '@libs/permissions-shared-ts/permission-catalog';
import { startedEntries } from '@libs/permissions-shared-ts/puzzle-ledger';
import { DAILY_PUZZLE_LIMIT_REASONS } from '@libs/permissions-shared-ts/reasons';
import {
  allOperations,
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared-ts/server';
import { dailyPuzzleLimitServerLayer } from '@libs/permissions-shared-ts/server-layers';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { turnGamesHeldTo } from '../conformance-world';

const [consumeQuota] = PERMISSIONS_MUTATIONS;

/** Every game offering puzzles: each one's starts count toward the same 20. */
const GAMES = turnGamesHeldTo('specs/games/daily-puzzle-limit.dmn');

/** The game whose puzzles were started before `game`'s: the next one round. */
function otherGame(game: TurnHarnessGame): TurnHarnessGame {
  const index = GAMES.indexOf(game);
  const other = GAMES[(index + 1) % GAMES.length];
  if (other === undefined || other === game)
    throw new Error('The daily puzzle limit needs two games offering puzzles');
  return other;
}

/**
 * The case's started puzzles as `game`'s rated starts, each of its own
 * puzzle, charged to the one ledger the way a device charges a start.
 */
async function insertStartsOf(
  db: SqlClient,
  game: TurnHarnessGame,
  input: CaseInput,
  nowMs: number
): Promise<void> {
  const ownerId = identityFor(personOf(input)).actorId;
  const namespace = puzzleNamespaceOfGame(game);
  for (const [index, entry] of startedEntries(input, nowMs).entries()) {
    const key = ratedPuzzleStartKey(
      `${namespace}started-${String(index)}`,
      Date.parse(entry.consumed_at)
    );
    await db.run(sql`
      INSERT INTO permissions_quota_ledger (
        id, owner_id, quota, idempotency_key, amount, consumed_at,
        policy_version, created_at, updated_at, deleted_at
      ) VALUES (
        ${`started-${String(index)}`}, ${ownerId}, ${ACTION.puzzleRatedSolve},
        ${key}, ${entry.amount}, ${entry.consumed_at}, ${'seeded'},
        ${entry.consumed_at}, ${entry.consumed_at}, ${null}
      )
    `);
  }
}

/**
 * One more rated puzzle of `game`, started and finished the way a device
 * sends it, after the case's starts of another game.
 */
function ratedResultServerLayer(game: TurnHarnessGame): DecisionLayer {
  const attempted = `${puzzleNamespaceOfGame(game)}attempted-puzzle`;
  const start = replayOperation(consumeQuota, (c) => ({
    id: 'attempted-start',
    quota: ACTION.puzzleRatedSolve,
    idempotencyKey: ratedPuzzleStartKey(attempted, c.nowMs),
  }));
  const result = replayOperation(RATE_PUZZLE_ATTEMPT, (c) => ({
    attemptKey: 'attempted-start',
    solveIdx: 3,
    ownerId: c.env.actorId,
    puzzleId: attempted,
    puzzleRating: 1500,
    puzzleRatingDeviation: 80,
    outcome: 'solved',
    scorePermille: 1000,
  }));
  const earlier = otherGame(game);
  return serverEnforcementLayer({
    tables: [...BILLING_TABLES, ...GAME_PUZZLE_SUB.tables],
    reasons: DAILY_PUZZLE_LIMIT_REASONS,
    seed: (c) => insertStartsOf(c.db, earlier, c.input, c.nowMs),
    operationFor: () => allOperations([start, result]),
  });
}

bindDecisions({
  spec: 'daily-puzzle-limit',
  layers: {
    'application decision': dailyPuzzleLimitApplicationLayer(),
    'server enforcement': dailyPuzzleLimitServerLayer({
      tables: BILLING_TABLES,
    }),
    ...Object.fromEntries(
      GAMES.map((game) => [
        `server enforcement of the rated result in ${game.label}`,
        ratedResultServerLayer(game),
      ])
    ),
    'client gating': dailyPuzzleLimitClientLayer({ tables: BILLING_TABLES }),
  },
});
