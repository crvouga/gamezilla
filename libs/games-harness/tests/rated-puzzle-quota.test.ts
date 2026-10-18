/**
 * The daily puzzle limit at the server boundary: a rated result is recorded
 * only for a rated puzzle whose start the quota charged, or for someone with
 * no limit. Mutations replay the way the server replays them (one
 * transaction, the product's authorize hook, then the body), on the server
 * clock.
 *
 * Signing in keeps the guest's user id when the Google identity is new (the
 * anonymous user is upgraded in place, `AccountProvisioningService`), and
 * switches to the existing account's id when it is not; either way the
 * signed-in person has no daily limit, so a puzzle a guest started and
 * finishes after signing in is rated.
 */
import { describe, expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared/puzzle-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared/rate-puzzle-attempt-mutation';
import { ratedStartKey } from '@libs/game-puzzle-shared/rated-start-key';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import { PERMISSIONS_MUTATIONS } from '@libs/permissions-shared/mutations';
import { CASE_NOW_MS, DMN_INPUT } from '@libs/permissions-shared/people';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import type { ServerCase } from '@libs/permissions-shared/server';
import { replayOperation } from '@libs/permissions-shared/server';
import {
  mutationEnvFor,
  openConformanceDb,
  seedAccess,
} from '@libs/permissions-shared/world';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';

const [consumeQuota] = PERMISSIONS_MUTATIONS;
const GUEST_LIMIT = 20;
const DAY_MS = 86_400_000;
const TABLES = [...BILLING_TABLES, ...PUZZLE_TABLES];

async function openGuestServer(): Promise<ServerCase> {
  const input = { [DMN_INPUT.who]: 'guest' };
  const db = await openConformanceDb(TABLES);
  await seedAccess(db, { input, nowMs: CASE_NOW_MS });
  return {
    db,
    env: mutationEnvFor('guest', CASE_NOW_MS),
    input,
    nowMs: CASE_NOW_MS,
    guard: authorizeAppMutation,
  };
}

/** The same server and person, `nowMs` on both clocks. */
function at(c: ServerCase, nowMs: number): ServerCase {
  return {
    ...c,
    nowMs,
    env: {
      ...c.env,
      now: () => new Date(nowMs),
      serverNow: () => new Date(nowMs),
    },
  };
}

/** The same server, the device now signed in as `identity`. */
function signedIn(
  c: ServerCase,
  identity: Pick<MutationEnv, 'actorId' | 'accountId' | 'isAnon'>
): ServerCase {
  return {
    ...c,
    env: {
      ...c.env,
      actorId: identity.actorId,
      accountId: identity.accountId,
      isAnon: identity.isAnon,
    },
  };
}

/** The guest signed in with a new Google identity: upgraded in place. */
function upgradedInPlace(c: ServerCase): ServerCase {
  return signedIn(c, {
    actorId: c.env.actorId,
    accountId: c.env.actorId,
    isAnon: false,
  });
}

/** The client's rated start: consume the quota for placing `puzzleId`. */
function startRated(c: ServerCase, puzzleId: string): Promise<void> {
  return replayOperation(consumeQuota, () => ({
    id: `ledger-${puzzleId}-${String(c.nowMs)}`,
    quota: ACTION.puzzleRatedSolve,
    idempotencyKey: ratedStartKey(puzzleId, c.nowMs),
  }))(c);
}

function rateSolved(c: ServerCase, puzzleId: string): Promise<void> {
  return replayOperation(ratePuzzleAttemptMutation, () => ({
    attemptKey: `attempt-${puzzleId}`,
    solveIdx: 3,
    ownerId: c.env.actorId,
    puzzleId,
    puzzleRating: 1500,
    puzzleRatingDeviation: 80,
    outcome: 'solved',
    scorePermille: 1000,
  }))(c);
}

async function refusalCode(run: Promise<void>): Promise<string | null> {
  try {
    await run;
    return null;
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
}

async function ratedResults(c: ServerCase, puzzleId: string): Promise<number> {
  const rows = await c.db.query(sql<{ readonly id: string }>`
    SELECT id FROM chess_puzzle_rating_events
    WHERE owner_id = ${c.env.actorId} AND puzzle_id = ${puzzleId}
  `);
  return rows.length;
}

/** A guest who started and rated `count` puzzles today (`puzzle-1…`). */
async function guestWhoPlayed(count: number): Promise<ServerCase> {
  const c = await openGuestServer();
  for (let i = 1; i <= count; i += 1) {
    await startRated(c, `puzzle-${String(i)}`);
    await rateSolved(c, `puzzle-${String(i)}`);
  }
  return c;
}

async function withServer(
  open: Promise<ServerCase>,
  body: (c: ServerCase) => Promise<void>
): Promise<void> {
  const c = await open;
  try {
    await body(c);
  } finally {
    await c.db.disconnect();
  }
}

const OVER = `puzzle-${String(GUEST_LIMIT + 1)}`;

describe('rated puzzle results and the daily puzzle limit', () => {
  test('a guest past the daily limit gets no rated result for a puzzle the quota never allowed', async () => {
    // regression: rated-puzzle-quota-bypass
    await withServer(guestWhoPlayed(GUEST_LIMIT), async (c) => {
      for (let i = 1; i <= GUEST_LIMIT; i += 1) {
        expect(await ratedResults(c, `puzzle-${String(i)}`)).toBe(1);
      }
      expect(await refusalCode(startRated(c, OVER))).toBe('quota_exhausted');
      // A client that skips (or lost) the refused start still sends the result.
      expect(await refusalCode(rateSolved(c, OVER))).toBe('quota_exhausted');
      expect(await ratedResults(c, OVER)).toBe(0);
    });
  });

  test('a guest under the limit who never started the puzzle gets no rated result', async () => {
    await withServer(guestWhoPlayed(0), async (c) => {
      expect(await refusalCode(rateSolved(c, 'unstarted'))).toBe(
        'quota_not_charged'
      );
      expect(await ratedResults(c, 'unstarted')).toBe(0);
    });
  });

  test('the puzzle on the board at the limit still finishes, and a replay records it once', async () => {
    await withServer(guestWhoPlayed(GUEST_LIMIT - 1), async (c) => {
      const last = `puzzle-${String(GUEST_LIMIT)}`;
      await startRated(c, last);
      expect(await refusalCode(rateSolved(c, last))).toBeNull();
      expect(await refusalCode(rateSolved(c, last))).toBeNull();
      expect(await ratedResults(c, last)).toBe(1);
    });
  });

  test('a puzzle started before midnight finishes after the next day is used up', async () => {
    await withServer(openGuestServer(), async (yesterday) => {
      await startRated(yesterday, 'late-night');
      const today = at(yesterday, CASE_NOW_MS + DAY_MS);
      for (let i = 1; i <= GUEST_LIMIT; i += 1) {
        await startRated(today, `today-${String(i)}`);
      }
      expect(await refusalCode(rateSolved(today, 'late-night'))).toBeNull();
      expect(await ratedResults(today, 'late-night')).toBe(1);
    });
  });

  test('a guest at the limit who signs in with a new Google identity has the puzzle on the board and the next one rated', async () => {
    await withServer(guestWhoPlayed(GUEST_LIMIT - 1), async (guest) => {
      const onBoard = `puzzle-${String(GUEST_LIMIT)}`;
      await startRated(guest, onBoard);
      const account = upgradedInPlace(guest);
      expect(await refusalCode(rateSolved(account, onBoard))).toBeNull();
      expect(await refusalCode(startRated(account, OVER))).toBeNull();
      expect(await refusalCode(rateSolved(account, OVER))).toBeNull();
      expect(await ratedResults(account, onBoard)).toBe(1);
      expect(await ratedResults(account, OVER)).toBe(1);
    });
  });

  test('a guest who signs in to an existing account mid-puzzle has that puzzle rated for the account', async () => {
    await withServer(guestWhoPlayed(GUEST_LIMIT - 1), async (guest) => {
      const onBoard = `puzzle-${String(GUEST_LIMIT)}`;
      await startRated(guest, onBoard);
      const account = signedIn(
        guest,
        mutationEnvFor('free account', guest.nowMs)
      );
      expect(await refusalCode(rateSolved(account, onBoard))).toBeNull();
      expect(await ratedResults(account, onBoard)).toBe(1);
    });
  });
});
