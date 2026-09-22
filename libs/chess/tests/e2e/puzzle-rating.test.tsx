// goal:chess-puzzles:8
/**
 * §8 rating system, driven through the real UI and the real sync engine.
 *
 * Everything here asserts the *server* value: the client writes an attempt,
 * the `ratePuzzleAttempt` mutation derives the profile inside the
 * transaction, and the engine syncs the authoritative row back. Seeded
 * fixture: `fixtures/chess-puzzles-rating.sim.csv` (14 puzzles clustered on
 * the 1500 seed rating, so RD falls at a realistic rate).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyPuzzleAttemptRating,
  DEFAULT_PUZZLE_RATING_STATE,
  isProvisionalPuzzleRating,
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/chess/public/chess-puzzle-rating';
import {
  leaveChessStatsScreen,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  reopenPuzzleFromChessMenu,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess/sim/chess-puzzle-data';
import {
  isPuzzleAttemptRated,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzlePickSource,
  readStatsRatingLabel,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  type PuzzleProfileRow,
  readLocalPuzzleProfile,
  readLocalRatingEvents,
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import {
  SIM_CHESS_FIXTURES_DIR,
  SIM_CHESS_PUZZLES,
} from '@libs/chess/sim/sim-chess-puzzles';
import {
  accountIdOf,
  partition,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

const RATING_CSV = readFileSync(
  join(SIM_CHESS_FIXTURES_DIR, 'chess-puzzles-rating.sim.csv'),
  'utf8'
);

const WAIT_MS = 30_000;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzles(s: OpenSim, actorId = 'alice'): Promise<void> {
  await s.apply(signInWithGoogle, actorId);
  await s.apply(returnToTabs, actorId);
  await s.apply(createSpace, actorId);
  await s.apply(openPuzzleFromSpace, actorId);
}

async function enterRatedPuzzles(s: OpenSim, actorId = 'alice'): Promise<void> {
  await s.apply(ingestChessPuzzleCsv, RATING_CSV);
  await enterPuzzles(s, actorId);
}

/** Alternate wins with zero-credit abandonment to keep the rating near the pool. */
async function abandonAndAdvance(s: OpenSim, actorId = 'alice'): Promise<void> {
  await s.apply(skipPuzzle, actorId);
  await s.apply(pressPuzzleNext, actorId);
}

/** The server's profile row for `actorId`, once the ledger holds `events`. */
async function settledServerProfile(
  s: OpenSim,
  ownerId: string,
  events: number
): Promise<PuzzleProfileRow> {
  await s.until(
    async (surf) =>
      (await readServerRatingEvents(surf, ownerId)).length === events,
    { maxMs: WAIT_MS, stepMs: 100 }
  );
  return required(
    await s.read(readServerPuzzleProfile, ownerId),
    'server profile'
  );
}

describe('§8 puzzle rating', () => {
  test('a new player starts at 1500 provisional; a solve raises it, a fail lowers it', async () => {
    await using s = await openSim('chess-puzzle-rating-start');
    await enterRatedPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    // No rated attempt yet: the chip shows the seed rating with the marker.
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readStatsRatingLabel, 'alice')).toBe(
      `${String(PUZZLE_RATING_DEFAULT)}?`
    );
    expect(await s.read(readServerPuzzleProfile, ownerId)).toBeNull();

    await s.apply(leaveChessStatsScreen, 'alice');
    await s.apply(reopenPuzzleFromChessMenu, 'alice');
    const solvedPuzzle = required(
      await s.read(readPuzzleDebug, 'alice'),
      'puzzle debug'
    );
    await s.apply(playUntilSolved, 'alice');
    const afterSolve = await settledServerProfile(s, ownerId, 1);
    expect(afterSolve.rating).toBeGreaterThan(PUZZLE_RATING_DEFAULT);
    expect(afterSolve.rating_deviation).toBeLessThan(PUZZLE_RATING_DEFAULT_RD);

    // The server value is exactly what the pure kernel says it should be.
    expect(afterSolve).toMatchObject(
      (() => {
        const expected = applyPuzzleAttemptRating({
          player: DEFAULT_PUZZLE_RATING_STATE,
          puzzleRating: required(solvedPuzzle.puzzleRating, 'puzzle rating'),
          puzzleRatingDeviation: 75,
          scorePermille: PUZZLE_SCORE_PERMILLE.win,
        });
        return {
          rating: expected.rating,
          rating_deviation: expected.ratingDeviation,
        };
      })()
    );

    await s.apply(pressPuzzleNext, 'alice');
    await s.apply(playWrongPuzzleMove, 'alice');
    const afterFail = await settledServerProfile(s, ownerId, 2);
    expect(afterFail.rating).toBeLessThan(afterSolve.rating);
    expect(afterFail.rating_deviation).toBeLessThan(
      afterSolve.rating_deviation
    );
  });

  test('the provisional marker clears once RD drops below the threshold', async () => {
    await using s = await openSim('chess-puzzle-rating-provisional');
    await enterRatedPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    // Alternate solve / abandon so the rating stays near the puzzle pool and RD
    // actually converges (a runaway rating learns nothing).
    let attempts = 0;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const settled = await s.read(readServerPuzzleProfile, ownerId);
      if (
        settled !== null &&
        !isProvisionalPuzzleRating(settled.rating_deviation)
      ) {
        break;
      }
      if (attempt % 2 === 0) {
        await s.apply(playUntilSolved, 'alice');
        await s.apply(pressPuzzleNext, 'alice');
      } else {
        await abandonAndAdvance(s, 'alice');
      }
      attempts += 1;
      // Invariant asserted every step: one ledger row per attempted puzzle.
      const events = await s.read(readServerRatingEvents, ownerId);
      expect(new Set(events.map((e) => e.puzzle_id)).size).toBe(events.length);
    }
    const profile = await settledServerProfile(s, ownerId, attempts);
    expect(isProvisionalPuzzleRating(profile.rating_deviation)).toBe(false);

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readStatsRatingLabel, 'alice')).toBe(
      String(profile.rating)
    );
  });

  test('an offline solve reconciles to the server value and never double-applies', async () => {
    await using s = await openSim('chess-puzzle-rating-offline');
    await enterRatedPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');
    const puzzle = required(
      await s.read(readPuzzleDebug, 'alice'),
      'puzzle debug'
    );

    await s.apply(partition, 'alice');
    await s.apply(playUntilSolved, 'alice');

    // Optimistic: the local row exists while the device is cut off.
    const optimistic = required(
      await s.read(readLocalPuzzleProfile, 'alice', ownerId),
      'optimistic profile'
    );
    expect(optimistic.rating).toBeGreaterThan(PUZZLE_RATING_DEFAULT);
    expect(await s.read(readServerPuzzleProfile, ownerId)).toBeNull();

    await s.apply(restoreNetwork);
    const authoritative = await settledServerProfile(s, ownerId, 1);

    // §34: the replayed attempt is applied exactly once — the ledger is keyed
    // by (owner, puzzle), so a duplicate upload collides instead of re-rating.
    const expected = applyPuzzleAttemptRating({
      player: DEFAULT_PUZZLE_RATING_STATE,
      puzzleRating: required(puzzle.puzzleRating, 'puzzle rating'),
      puzzleRatingDeviation: 75,
      scorePermille: PUZZLE_SCORE_PERMILLE.win,
    });
    expect(authoritative.rating).toBe(expected.rating);
    expect(authoritative.rating_deviation).toBe(expected.ratingDeviation);
    expect((await s.read(readServerRatingEvents, ownerId)).length).toBe(1);

    // The client reconciles onto the server's row.
    await s.until(
      async (surf) => {
        const local = await readLocalPuzzleProfile(surf, 'alice', ownerId);
        return local?.rating === authoritative.rating;
      },
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    const local = required(
      await s.read(readLocalPuzzleProfile, 'alice', ownerId),
      'local profile'
    );
    expect(local.rating).toBe(authoritative.rating);
    expect((await s.read(readLocalRatingEvents, 'alice', ownerId)).length).toBe(
      1
    );
  });

  test('a repeat attempt on an already-rated puzzle leaves the rating alone', async () => {
    // No extra fixture: the three seeded sim puzzles are exhausted on purpose,
    // then the feed is widened to include played puzzles so one comes round
    // again — a genuine second attempt, not a retry of the same play.
    await using s = await openSim('chess-puzzle-rating-repeat');
    await enterPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    const played: string[] = [];
    for (let i = 0; i < SIM_CHESS_PUZZLES.length; i += 1) {
      played.push(
        required(await s.read(readActivePuzzleId, 'alice'), 'active puzzle')
      );
      await s.apply(playUntilSolved, 'alice');
      if (i < SIM_CHESS_PUZZLES.length - 1) {
        await s.apply(pressPuzzleNext, 'alice');
      }
    }
    const afterFirstPass = await settledServerProfile(
      s,
      ownerId,
      SIM_CHESS_PUZZLES.length
    );

    // §9: the pool is exhausted, so the feed comes round to the oldest
    // attempt — the same puzzle, a second time.
    await s.apply(pressPuzzleNext, 'alice');
    await s.until(
      async (surf) =>
        (await readPuzzlePickSource(surf, 'alice')) === 'exhausted',
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    const repeated = required(
      await s.read(readActivePuzzleId, 'alice'),
      'repeated puzzle'
    );
    expect(played).toContain(repeated);
    expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(false);

    await s.apply(playUntilSolved, 'alice');
    // The outcome is recorded; the rating is not (§8).
    const events = await s.read(readServerRatingEvents, ownerId);
    expect(events.length).toBe(SIM_CHESS_PUZZLES.length);
    const afterRepeat = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );
    expect(afterRepeat.rating).toBe(afterFirstPass.rating);
    expect(afterRepeat.rating_deviation).toBe(afterFirstPass.rating_deviation);
  });

  test('two devices of one account converge on a single rating', async () => {
    // §34 "same account on two devices": the account's rating lives on the
    // server, so a second device adopts it instead of starting at 1500, and
    // both devices stay on the same number as it moves.
    await using s = await openSim('chess-puzzle-rating-two-devices');
    await enterRatedPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNext, 'alice');
    await s.apply(playUntilSolved, 'alice');
    const authoritative = await settledServerProfile(s, ownerId, 2);

    await s.apply(spawnActor, 'bob');
    await s.apply(signInWithGoogleAsAccount, 'bob', 'alice');
    await s.until(
      async (surf) => {
        const local = await readLocalPuzzleProfile(surf, 'bob', ownerId);
        return local?.rating === authoritative.rating;
      },
      { maxMs: WAIT_MS, stepMs: 100 }
    );

    for (const device of ['alice', 'bob'] as const) {
      const local = required(
        await s.read(readLocalPuzzleProfile, device, ownerId),
        `${device} profile`
      );
      expect(local.rating).toBe(authoritative.rating);
      expect(local.rating_deviation).toBe(authoritative.rating_deviation);
      expect(
        (await s.read(readLocalRatingEvents, device, ownerId)).length
      ).toBe(2);
    }
  });
});
