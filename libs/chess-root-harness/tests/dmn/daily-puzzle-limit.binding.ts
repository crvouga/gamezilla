import { PUZZLE_TABLES } from '@libs/game-puzzle-shared/puzzle-tables';
/**
 * `specs/chess/daily-puzzle-limit.dmn` against the permission system:
 *
 * - application decision — the kernel's quota decision for the case's
 *   person (facts from the product's resolver), counting the case's solved
 *   puzzles through the product's window and ledger arithmetic;
 * - server enforcement — the rated-puzzle consume replayed against a server
 *   database holding the person's started puzzles on the UTC day boundary
 *   (today's at midnight, earlier ones a millisecond before): allowed adds
 *   one ledger row, refused adds none and says why;
 * - server enforcement of the rated result — the same server, a rated puzzle
 *   played through as a device sends it: the start's consume, then the rated
 *   result (`ratePuzzleAttempt`), both replayed with the authorize hook. Both
 *   must be allowed or both refused; a refused case must leave no rated
 *   result (nor anything else) stored, so a result recorded past the limit
 *   fails the case;
 * - client gating — what the device answers when a rated puzzle is about to
 *   start (`usePermissions().can`), the same started puzzles in its synced
 *   ledger.
 */

import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared/rate-puzzle-attempt-mutation';
import { ratedStartKey } from '@libs/game-puzzle-shared/rated-start-key';
import { dailyPuzzleLimitClientLayer } from '@libs/permissions-harness/client-layers';
import { dailyPuzzleLimitApplicationLayer } from '@libs/permissions-shared/application';
import { PERMISSIONS_MUTATIONS } from '@libs/permissions-shared/mutations';
import { identityFor, personOf } from '@libs/permissions-shared/people';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import {
  insertStarted,
  startedEntries,
} from '@libs/permissions-shared/puzzle-ledger';
import { DAILY_PUZZLE_LIMIT_REASONS } from '@libs/permissions-shared/reasons';
import {
  allOperations,
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { dailyPuzzleLimitServerLayer } from '@libs/permissions-shared/server-layers';
import type { DecisionLayer } from '@pkgs/dmn-shared/registry';
import { bindDecisions } from '@pkgs/dmn-shared/registry';

const [consumeQuota] = PERMISSIONS_MUTATIONS;
const ATTEMPTED_PUZZLE = 'attempted-puzzle';

/** One more rated puzzle, started and finished the way a device sends it. */
function ratedResultServerLayer(): DecisionLayer {
  const start = replayOperation(consumeQuota, (c) => ({
    id: 'attempted-start',
    quota: ACTION.puzzleRatedSolve,
    idempotencyKey: ratedStartKey(ATTEMPTED_PUZZLE, c.nowMs),
  }));
  const result = replayOperation(ratePuzzleAttemptMutation, (c) => ({
    attemptKey: 'attempted-start',
    solveIdx: 3,
    ownerId: c.env.actorId,
    puzzleId: ATTEMPTED_PUZZLE,
    puzzleRating: 1500,
    puzzleRatingDeviation: 80,
    outcome: 'solved',
    scorePermille: 1000,
  }));
  return serverEnforcementLayer({
    tables: [...BILLING_TABLES, ...PUZZLE_TABLES, ...CHESS_TABLES],
    reasons: DAILY_PUZZLE_LIMIT_REASONS,
    seed: (c) =>
      insertStarted(c.db, {
        ownerId: identityFor(personOf(c.input)).actorId,
        entries: startedEntries(c.input, c.nowMs),
      }),
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
    'server enforcement of the rated result': ratedResultServerLayer(),
    'client gating': dailyPuzzleLimitClientLayer({ tables: BILLING_TABLES }),
  },
});
