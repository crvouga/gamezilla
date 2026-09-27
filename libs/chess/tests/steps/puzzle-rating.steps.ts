/**
 * The puzzle rating and its record: rated attempts on the device and on the
 * server, the stats screen and the game log, and how both converge after
 * offline play, sign-in, and a second device.
 */

import { expect } from 'bun:test';

import {
  applyPuzzleAttemptRating,
  DEFAULT_PUZZLE_RATING_STATE,
  isProvisionalPuzzleRating,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_SCORE_PERMILLE,
} from '@libs/chess/public/chess-puzzle-rating';
import {
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  requestPuzzleHint,
  retryPuzzle,
  showPuzzleSolutionLine,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import { readServerPuzzles } from '@libs/chess/sim/chess-puzzle-data';
import {
  countLocalWrongMoves,
  countServerWrongMoves,
} from '@libs/chess/sim/chess-puzzle-ledger-data';
import {
  isGameLogEmpty,
  readGameLogRowTitle,
  readStatsAccuracy,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  type PuzzleProfileRow,
  type PuzzleRatingEventRow,
  readLocalPuzzleProfile,
  readLocalRatingEvents,
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import { focusActor } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { remember } from '@libs/sim-harness/spec/world';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import {
  currentPuzzle,
  ensureStatsOpen,
  lastPlayer,
  otherDevice,
  puzzleOwner,
  recalled,
  required,
  SECOND_MS,
  SERVABLE_KEY,
  trackPuzzle,
  waitSolverToMove,
} from './puzzle-world';

/** Attempts before giving up on a rating settling (as many as the pool). */
const MAX_SETTLING_ATTEMPTS = 16;

const afterSolveKey = (actor: Actor) => `profileAfterSolve:${actor}`;
const deviceProfileKey = (actor: Actor) => `deviceProfile:${actor}`;
const deviceEventsKey = (actor: Actor) => `deviceEvents:${actor}`;

type Figures = {
  readonly played: number;
  readonly solved: number;
  readonly accuracy: number;
};

/** What the stats must show, folded from rated attempts. */
function figuresOf(events: readonly PuzzleRatingEventRow[]): Figures {
  const played = events.length;
  const solved = events.filter((e) => e.outcome === 'solved').length;
  return {
    played,
    solved,
    accuracy: played > 0 ? Math.round((solved / played) * 100) : 0,
  };
}

/** Event rows with timestamps in one format, so both sides compare. */
function normalized(events: readonly PuzzleRatingEventRow[]) {
  return events.map((event) => ({
    ...event,
    at: new Date(event.at).toISOString(),
  }));
}

async function shownFigures(w: SimWorld, actor: Actor): Promise<Figures> {
  return {
    played: required(await w.s.read(readStatsPlayed, actor), 'played'),
    solved: required(await w.s.read(readStatsSolved, actor), 'solved'),
    accuracy: required(await w.s.read(readStatsAccuracy, actor), 'accuracy'),
  };
}

async function serverEvents(w: SimWorld, actor: Actor) {
  return w.s.read(readServerRatingEvents, await puzzleOwner(w, actor));
}

async function deviceEvents(w: SimWorld, device: string, actor: Actor) {
  return w.s.read(readLocalRatingEvents, device, await puzzleOwner(w, actor));
}

async function serverProfile(
  w: SimWorld,
  actor: Actor
): Promise<PuzzleProfileRow> {
  return required(
    await w.s.read(readServerPuzzleProfile, await puzzleOwner(w, actor)),
    `the server's puzzle rating for ${actor}`
  );
}

async function deviceProfile(
  w: SimWorld,
  device: string,
  actor: Actor
): Promise<PuzzleProfileRow> {
  return required(
    await w.s.read(readLocalPuzzleProfile, device, await puzzleOwner(w, actor)),
    `${device}'s puzzle rating`
  );
}

async function untilServerEvents(
  w: SimWorld,
  actor: Actor,
  count: number,
  seconds: number
): Promise<void> {
  const owner = await puzzleOwner(w, actor);
  await w.s.until(async (surf) => readServerRatingEvents(surf, owner), {
    maxMs: seconds * SECOND_MS,
    pred: (events) => events.length === count,
  });
}

/** Snapshot the device's rating state the first time a step reads it. */
async function noteDeviceState(w: SimWorld, actor: Actor): Promise<void> {
  if (!w.memo.has(deviceProfileKey(actor))) {
    remember(w, deviceProfileKey(actor), await deviceProfile(w, actor, actor));
    remember(w, deviceEventsKey(actor), await deviceEvents(w, actor, actor));
  }
}

/** The rating the formula gives a new player winning against `puzzleId`. */
async function formulaWinAgainst(w: SimWorld, puzzleId: string) {
  const row = required(
    (await w.s.read(readServerPuzzles)).find((p) => p.id === puzzleId),
    `stored puzzle ${puzzleId}`
  );
  return applyPuzzleAttemptRating({
    player: DEFAULT_PUZZLE_RATING_STATE,
    puzzleRating: row.rating,
    puzzleRatingDeviation: row.rating_deviation,
    scorePermille: PUZZLE_SCORE_PERMILLE.win,
  });
}

function expectOnePerPuzzle(events: readonly PuzzleRatingEventRow[]): void {
  expect(new Set(events.map((e) => e.puzzle_id)).size).toBe(events.length);
}

// ---------------------------------------------------------- server record

Then(
  'the server holds {int} rated attempt(s) for {actor} within {int} seconds',
  async (w, count: number, actor: Actor, seconds: number) => {
    await untilServerEvents(w, actor, count, seconds);
  }
);

Then(
  'the server holds {int} rated attempt(s) for {actor}',
  async (w, count: number, actor: Actor) => {
    expect(await serverEvents(w, actor)).toHaveLength(count);
  }
);

Then(
  'the server holds no rated attempts for {actor}',
  async (w, actor: Actor) => {
    expect(await serverEvents(w, actor)).toEqual([]);
  }
);

Then(
  'the server holds no puzzle rating for {actor}',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(readServerPuzzleProfile, await puzzleOwner(w, actor))
    ).toBeNull();
  }
);

Then(
  'the server holds a rated attempt for every servable puzzle within {int} seconds',
  async (w, seconds: number) => {
    const servable = recalled<readonly string[]>(w, SERVABLE_KEY);
    const actor = lastPlayer(w);
    await untilServerEvents(w, actor, servable.length, seconds);
    const ids = (await serverEvents(w, actor)).map((e) => e.puzzle_id);
    expect([...ids].sort()).toEqual([...servable].sort());
  }
);

Then(
  'the server holds a rated attempt for every servable puzzle',
  async (w) => {
    const servable = recalled<readonly string[]>(w, SERVABLE_KEY);
    const ids = (await serverEvents(w, lastPlayer(w))).map((e) => e.puzzle_id);
    expect([...ids].sort()).toEqual([...servable].sort());
  }
);

Then(
  "{actor}'s server rating is above {int}",
  async (w, actor: Actor, rating: number) => {
    expect((await serverProfile(w, actor)).rating).toBeGreaterThan(rating);
  }
);

Then(
  "{actor}'s server rating deviation is below the starting deviation",
  async (w, actor: Actor) => {
    expect((await serverProfile(w, actor)).rating_deviation).toBeLessThan(
      PUZZLE_RATING_DEFAULT_RD
    );
  }
);

Then(
  "{actor}'s server rating is exactly the rating formula's result for a win against that puzzle",
  async (w, actor: Actor) => {
    const expected = await formulaWinAgainst(w, currentPuzzle(w, actor));
    expect(await serverProfile(w, actor)).toMatchObject({
      rating: expected.rating,
      rating_deviation: expected.ratingDeviation,
    });
  }
);

Given(
  '{actor} has solved one puzzle and the server has rated it',
  async (w, actor: Actor) => {
    await w.s.apply(playUntilSolved, actor);
    await untilServerEvents(w, actor, 1, 30);
    remember(w, afterSolveKey(actor), await serverProfile(w, actor));
  }
);

Then(
  "{actor}'s server rating is below what it was after the solve",
  async (w, actor: Actor) => {
    const after = recalled<PuzzleProfileRow>(w, afterSolveKey(actor));
    expect((await serverProfile(w, actor)).rating).toBeLessThan(after.rating);
  }
);

Then(
  "{actor}'s server rating deviation is below what it was after the solve",
  async (w, actor: Actor) => {
    const after = recalled<PuzzleProfileRow>(w, afterSolveKey(actor));
    expect((await serverProfile(w, actor)).rating_deviation).toBeLessThan(
      after.rating_deviation
    );
  }
);

When(
  '{actor} alternately solves and skips puzzles until their rating is no longer provisional',
  async (w, actor: Actor) => {
    const owner = await puzzleOwner(w, actor);
    let attempts = 0;
    for (let attempt = 0; attempt < MAX_SETTLING_ATTEMPTS; attempt += 1) {
      const settled = await w.s.read(readServerPuzzleProfile, owner);
      if (
        settled !== null &&
        !isProvisionalPuzzleRating(settled.rating_deviation)
      ) {
        break;
      }
      // Solve, then abandon (zero credit): the rating stays near the pool,
      // so the deviation actually converges.
      await w.s.apply(attempt % 2 === 0 ? playUntilSolved : skipPuzzle, actor);
      await w.s.apply(pressPuzzleNext, actor);
      await trackPuzzle(w, actor);
      attempts += 1;
      expectOnePerPuzzle(await w.s.read(readServerRatingEvents, owner));
    }
    await untilServerEvents(w, actor, attempts, 30);
  }
);

Then(
  'each puzzle {actor} attempted was rated at most once',
  async (w, actor: Actor) => {
    expectOnePerPuzzle(await serverEvents(w, actor));
  }
);

Then("{actor}'s server rating is not provisional", async (w, actor: Actor) => {
  const profile = await serverProfile(w, actor);
  expect(isProvisionalPuzzleRating(profile.rating_deviation)).toBe(false);
});

Then(
  "{actor}'s server rating is still provisional",
  async (w, actor: Actor) => {
    const profile = await serverProfile(w, actor);
    expect(isProvisionalPuzzleRating(profile.rating_deviation)).toBe(true);
  }
);

Then(
  "{actor}'s rated attempts add up to {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    expect(figuresOf(await serverEvents(w, actor))).toEqual({
      played,
      solved,
      accuracy,
    });
  }
);

Then(
  'the server records {int} wrong move(s) by {actor} on that puzzle within {int} seconds',
  async (w, count: number, actor: Actor, seconds: number) => {
    const owner = await puzzleOwner(w, actor);
    const puzzle = currentPuzzle(w, actor);
    await w.s.until((surf) => countServerWrongMoves(surf, owner, puzzle), {
      maxMs: seconds * SECOND_MS,
      pred: (n) => n === count,
    });
    expect(await w.s.read(countServerWrongMoves, owner, puzzle)).toBe(count);
  }
);

// ---------------------------------------------------------- device record

Then(
  "{actor}'s device holds {int} rated attempt(s)",
  async (w, actor: Actor, count: number) => {
    expect(await deviceEvents(w, actor, actor)).toHaveLength(count);
    if (count > 0) await noteDeviceState(w, actor);
  }
);

Then(
  "{actor}'s device holds {int} rated attempt(s), for that puzzle, {word} with a score of {float}",
  async (
    w,
    actor: Actor,
    ...[count, outcome, score]: [number, string, number]
  ) => {
    const events = await deviceEvents(w, actor, actor);
    expect(events).toHaveLength(count);
    expect(events[0]).toMatchObject({
      puzzle_id: currentPuzzle(w, actor),
      outcome,
      score_permille: Math.round(score * 1000),
    });
    await noteDeviceState(w, actor);
  }
);

Then(
  "{actor}'s device still holds only that {int} rated attempt(s)",
  async (w, actor: Actor, count: number) => {
    const events = await deviceEvents(w, actor, actor);
    expect(events).toHaveLength(count);
    expect(normalized(events)).toEqual(
      normalized(recalled<PuzzleRatingEventRow[]>(w, deviceEventsKey(actor)))
    );
  }
);

Then(
  "{actor}'s device still holds the same puzzle rating",
  async (w, actor: Actor) => {
    expect(await deviceProfile(w, actor, actor)).toEqual(
      recalled<PuzzleProfileRow>(w, deviceProfileKey(actor))
    );
  }
);

Then(
  "the server's rated attempts for {actor} (still )match the device's",
  async (w, actor: Actor) => {
    const device = recalled<PuzzleRatingEventRow[]>(w, deviceEventsKey(actor));
    expect(normalized(await serverEvents(w, actor))).toEqual(
      normalized(device)
    );
  }
);

Then(
  "the server's puzzle rating for {actor} matches the device's",
  async (w, actor: Actor) => {
    expect(await serverProfile(w, actor)).toEqual(
      recalled<PuzzleProfileRow>(w, deviceProfileKey(actor))
    );
  }
);

Then(
  "the server's puzzle rating for {actor} matches the rating from the offline solve",
  async (w, actor: Actor) => {
    expect(await serverProfile(w, actor)).toEqual(
      recalled<PuzzleProfileRow>(w, deviceProfileKey(actor))
    );
  }
);

Then(
  "{actor}'s device rating is above {int}",
  async (w, actor: Actor, rating: number) => {
    expect((await deviceProfile(w, actor, actor)).rating).toBeGreaterThan(
      rating
    );
  }
);

Then(
  "{actor}'s device rating matches the server within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const server = await serverProfile(w, actor);
    const owner = await puzzleOwner(w, actor);
    await w.s.until((surf) => readLocalPuzzleProfile(surf, actor, owner), {
      maxMs: seconds * SECOND_MS,
      pred: (local) => local?.rating === server.rating,
    });
    expect((await deviceProfile(w, actor, actor)).rating).toBe(server.rating);
  }
);

Then(
  "{actor}'s device records {int} wrong move(s) on that puzzle",
  async (w, actor: Actor, count: number) => {
    expect(
      await w.s.read(countLocalWrongMoves, actor, currentPuzzle(w, actor))
    ).toBe(count);
  }
);

// -------------------------------------------------------- offline finishes

When(
  '{actor} finishes the puzzle by {string}',
  async (w, actor: Actor, finish: string) => {
    switch (finish) {
      case 'a clean solve':
        await w.s.apply(playUntilSolved, actor);
        return;
      case 'a hint, then a solve':
        await w.s.apply(requestPuzzleHint, actor);
        await w.s.apply(playUntilSolved, actor);
        return;
      case 'a wrong move, a retry, then a solve':
        await w.s.apply(playWrongPuzzleMove, actor);
        await w.s.apply(retryPuzzle, actor);
        await waitSolverToMove(w, actor);
        await w.s.apply(playUntilSolved, actor);
        return;
      case 'showing the solution':
        await w.s.apply(showPuzzleSolutionLine, actor);
        return;
      case 'a skip':
        await w.s.apply(skipPuzzle, actor);
        return;
      default:
        throw new Error(`no way to finish a puzzle by "${finish}"`);
    }
  }
);

// ------------------------------------------------ guest progress, devices

Then(
  "{actor}'s account keeps the progress they made as a guest",
  async (w, actor: Actor) => {
    expect(await w.s.read(accountIdOf, actor)).toBe(
      await puzzleOwner(w, actor)
    );
  }
);

Then(
  "{actor}'s other device holds {int} rated attempt(s) within {int} seconds",
  async (w, actor: Actor, count: number, seconds: number) => {
    const owner = await puzzleOwner(w, actor);
    await w.s.until(
      (surf) => readLocalRatingEvents(surf, otherDevice(actor), owner),
      { maxMs: seconds * SECOND_MS, pred: (events) => events.length === count }
    );
  }
);

Then(
  "both of {actor}'s devices hold the puzzle rating from the offline solve",
  async (w, actor: Actor) => {
    const offline = recalled<PuzzleProfileRow>(w, deviceProfileKey(actor));
    for (const device of [actor, otherDevice(actor)]) {
      expect(await deviceProfile(w, device, actor)).toEqual(offline);
    }
  }
);

Then(
  "both of {actor}'s devices hold exactly {int} rated attempt(s), for the solved puzzle, with full credit",
  async (w, actor: Actor, count: number) => {
    for (const device of [actor, otherDevice(actor)]) {
      const events = await deviceEvents(w, device, actor);
      expect(events).toHaveLength(count);
      for (const event of events) {
        expect(event).toMatchObject({
          puzzle_id: currentPuzzle(w, actor),
          score_permille: PUZZLE_SCORE_PERMILLE.win,
        });
      }
    }
  }
);

Then(
  "{actor}'s other device shows the server rating within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const server = await serverProfile(w, actor);
    const owner = await puzzleOwner(w, actor);
    await w.s.until(
      (surf) => readLocalPuzzleProfile(surf, otherDevice(actor), owner),
      {
        maxMs: seconds * SECOND_MS,
        pred: (local) => local?.rating === server.rating,
      }
    );
  }
);

Then(
  "both of {actor}'s devices hold the server's rating and deviation",
  async (w, actor: Actor) => {
    const server = await serverProfile(w, actor);
    for (const device of [actor, otherDevice(actor)]) {
      const local = await deviceProfile(w, device, actor);
      expect(local.rating).toBe(server.rating);
      expect(local.rating_deviation).toBe(server.rating_deviation);
    }
  }
);

Then(
  "both of {actor}'s devices hold {int} rated attempt(s)",
  async (w, actor: Actor, count: number) => {
    for (const device of [actor, otherDevice(actor)]) {
      expect(await deviceEvents(w, device, actor)).toHaveLength(count);
    }
  }
);

// ------------------------------------------------------ stats and game log

When('{actor} opens their stats', async (w, actor: Actor) => {
  await ensureStatsOpen(w, actor);
});

Then(
  "{actor}'s stats show a rating of {string}",
  async (w, actor: Actor, label: string) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsRatingLabel, actor)).toBe(label);
  }
);

Then(
  "{actor}'s stats show {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await ensureStatsOpen(w, actor);
    expect(await shownFigures(w, actor)).toEqual({ played, solved, accuracy });
  }
);

Then(
  "{actor}'s stats show the played, solved, and accuracy figures of their rated attempts",
  async (w, actor: Actor) => {
    await ensureStatsOpen(w, actor);
    expect(await shownFigures(w, actor)).toEqual(
      figuresOf(await serverEvents(w, actor))
    );
  }
);

Then(
  "{actor}'s stats show their server rating with no provisional marker",
  async (w, actor: Actor) => {
    await ensureStatsOpen(w, actor);
    const profile = await serverProfile(w, actor);
    expect(await w.s.read(readStatsRatingLabel, actor)).toBe(
      String(profile.rating)
    );
  }
);

Then(
  "{actor}'s stats show their server rating with the provisional marker",
  async (w, actor: Actor) => {
    await ensureStatsOpen(w, actor);
    const profile = await serverProfile(w, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(profile.rating);
    expect(await w.s.read(readStatsRatingLabel, actor)).toBe(
      `${String(profile.rating)}?`
    );
  }
);

Then(
  "{actor}'s puzzle rating is above {int}",
  async (w, actor: Actor, rating: number) => {
    const elo = required(await w.s.read(readStatsElo, actor), 'rating');
    expect(elo).toBeGreaterThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is below {int}",
  async (w, actor: Actor, rating: number) => {
    const elo = required(await w.s.read(readStatsElo, actor), 'rating');
    expect(elo).toBeLessThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is {int}",
  async (w, actor: Actor, rating: number) => {
    await w.s.apply(focusActor, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(rating);
  }
);

const LOG_TITLES: Partial<Record<string, RegExp>> = {
  solved: /^Solved/,
  failed: /^Failed/,
  abandoned: /^Abandoned/,
};

Then(
  "{actor}'s game log records that puzzle as {word}",
  async (w, actor: Actor, outcome: string) => {
    const title = LOG_TITLES[outcome];
    if (title === undefined)
      throw new Error(`no game log outcome "${outcome}"`);
    await ensureStatsOpen(w, actor);
    expect(
      await w.s.read(readGameLogRowTitle, actor, currentPuzzle(w, actor))
    ).toMatch(title);
  }
);

Then(
  "{actor}'s game log is empty within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isGameLogEmpty(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
