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

import { BILLING_TABLES } from '@libs/billing/public/schema';
import { ratedStartKey } from '@libs/chess/public/chess-puzzle-rated-start-key';
import { CHESS_TABLES } from '@libs/chess/public/schema';
import { ratePuzzleAttemptMutation } from '@libs/chess/root/mutations';
import { ACTION } from '@libs/permissions/public/permission-catalog';
import { dailyPuzzleLimitApplicationLayer } from '@libs/permissions/root/conformance/application';
import { dailyPuzzleLimitClientLayer } from '@libs/permissions/root/conformance/client-layers';
import {
  identityFor,
  personOf,
} from '@libs/permissions/root/conformance/people';
import {
  insertStarted,
  startedEntries,
} from '@libs/permissions/root/conformance/puzzle-ledger';
import { DAILY_PUZZLE_LIMIT_REASONS } from '@libs/permissions/root/conformance/reasons';
import {
  allOperations,
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions/root/conformance/server';
import { dailyPuzzleLimitServerLayer } from '@libs/permissions/root/conformance/server-layers';
import { PERMISSIONS_MUTATIONS } from '@libs/permissions/root/mutations';
import { bindDecisions, type DecisionLayer } from '@pkgs/dmn/registry';

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
    ownerId: c.env.actorId,
    puzzleId: ATTEMPTED_PUZZLE,
    puzzleRating: 1500,
    puzzleRatingDeviation: 80,
    outcome: 'solved',
    scorePermille: 1000,
  }));
  return serverEnforcementLayer({
    tables: [...BILLING_TABLES, ...CHESS_TABLES],
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
