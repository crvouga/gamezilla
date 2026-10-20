/**
 * What the puzzle steps share, for the run's game: its known puzzles (the
 * independent oracle every expected move, position and label comes from),
 * the puzzle each person is on and the one before it, and the ways onto
 * the board and to the stats. No step definitions here.
 */

import { expect } from 'bun:test';
import { rulesTrail } from '@libs/game-session-harness/game-puzzle-laws';
import type { PuzzleFixture } from '@libs/game-session-harness/known-puzzles';
import { chosenFeedTheme } from '@libs/game-session-harness/puzzle-feed-choices';
import {
  knownPuzzle,
  knownPuzzlesOf,
  theKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import type { PoolPuzzle } from '@libs/game-session-harness/puzzle-pool';
import {
  puzzleNamespaceOfGame,
  readCataloguePuzzle,
  writeKnownPuzzlePool,
} from '@libs/game-session-harness/puzzle-pool';
import {
  isPuzzleStatsShown,
  leaveGamePuzzleStats,
  readCataloguePuzzles,
  readStatsPuzzleRating,
  retireCataloguePuzzle,
  showGamePuzzleStats,
} from '@libs/game-session-harness/puzzle-records';
import {
  goBackToGamePuzzles,
  isPuzzleScreenShown,
  openGamePuzzles,
  openGamePuzzlesNoWait,
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { readPuzzleSoundsPlayed } from '@libs/game-session-harness/puzzle-sounds';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import { accountIdOf } from '@libs/harness/identity';
import { otherDevice } from '@libs/harness/platform';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  createSpace,
  reopenSpaceLink,
} from '@libs/spaces-harness/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { gameOf } from './game-world';

export const SECOND_MS = 1_000;
/** How long a puzzle screen may take to settle when a step names no time. */
export const SETTLE_MS = 20_000;

/** The visible current position before the scenario chooses an earlier one. */
export const puzzlePositionBeforeReviewKey = (actor: string): string =>
  `puzzle-position-before-review:${actor}`;

/** The run's game's id, as its puzzles and choices are found by. */
export function puzzleGameId(w: HarnessWorld): string {
  return gameOf(w).shared.id;
}

/** Someone with puzzle progress of their own has an account: sign in if not yet. */
export async function withAccount(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  if ((await w.s.read(accountIdOf, actor)) !== null) return;
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(returnToTabs, actor);
}

export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined)
    throw new Error(`expected ${what}`);
  return value;
}

// --------------------------------------------------------- the puzzle on

const currentKey = (actor: string) => `puzzle:${actor}`;
const previousKey = (actor: string) => `puzzle-before:${actor}`;
const LAST_PLAYER = 'puzzle-last-player';

/** Whether `actor` has been on a puzzle in this scenario. */
export function playsPuzzles(w: HarnessWorld, actor: string): boolean {
  return w.memo.has(currentKey(actor));
}

/**
 * Note the puzzle now on `actor`'s board as "that puzzle", and the one it
 * replaced as "the one before".
 */
export async function trackPuzzle(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  const id = required(
    await w.s.read(readPuzzleOnBoard, actor),
    `a puzzle on ${actor}'s board`
  );
  const current = w.memo.get(currentKey(actor));
  if (current !== id) w.memo.set(previousKey(actor), current ?? null);
  w.memo.set(currentKey(actor), id);
  w.memo.set(LAST_PLAYER, actor);
  return id;
}

/** Whose puzzle a step means when it names no one: the last one seen. */
export function lastPuzzlePlayer(w: HarnessWorld): string {
  return required(
    w.memo.get(LAST_PLAYER) as string | undefined,
    'someone on a puzzle'
  );
}

/** "That puzzle": the one `actor` was last seen on. */
export function currentPuzzle(w: HarnessWorld, actor: string): string {
  return required(
    w.memo.get(currentKey(actor)) as string | undefined,
    `a puzzle ${actor} is on`
  );
}

/** "The one before": the puzzle the last move-on replaced. */
export function previousPuzzle(w: HarnessWorld, actor: string): string {
  return required(
    w.memo.get(previousKey(actor)) as string | null | undefined,
    `a puzzle ${actor} was on before`
  );
}

/** The known puzzle `actor` is on, as its author wrote it. */
export function puzzleOn(w: HarnessWorld, actor: string): PuzzleFixture {
  return knownPuzzle(gameOf(w), currentPuzzle(w, actor));
}

/**
 * The positions of `fixture`'s line, its position before the setup move
 * first, asked of the game's rules alone.
 */
export function lineOf(
  w: HarnessWorld,
  fixture: PuzzleFixture
): readonly string[] {
  return rulesTrail(gameOf(w).shared.turnGame.rules, fixture.record);
}

/** How the game writes the line move `label` in its default notation. */
export function writtenAs(w: HarnessWorld, label: string): string {
  const notation = gameOf(w).client.puzzles?.notation;
  const first = notation?.choices[0];
  return notation === undefined || first === undefined
    ? label
    : notation.format(label, first);
}

// --------------------------------------------------------- into a puzzle

/** Into `actor`'s space, starting one if they are in none. */
async function intoSpace(w: HarnessWorld, actor: string): Promise<void> {
  await w.s.apply(focusActor, actor);
  if (!(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(createSpace, actor);
  }
}

/** Open the game's puzzles in `actor`'s space, starting one if needed. */
export async function enterPuzzles(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  await intoSpace(w, actor);
  await w.s.apply(openGamePuzzles, actor, puzzleGameId(w));
  return trackPuzzle(w, actor);
}

/**
 * Open the game's puzzles in `actor`'s space without waiting for a puzzle:
 * the feed may have none to serve.
 */
export async function openPuzzles(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await intoSpace(w, actor);
  await w.s.apply(openGamePuzzlesNoWait, actor, puzzleGameId(w));
}

/** A `Given` needing a puzzle on the board opens one unless there is one. */
export async function ensureOnPuzzle(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  if (!playsPuzzles(w, actor)) await enterPuzzles(w, actor);
}

const KNOWN_ONLY = 'puzzle-pool:known-only';

/**
 * The game's known puzzle on `actor`'s board: the pool keeps it alone, so
 * the feed serves it.
 */
export async function enterKnownPuzzle(
  w: HarnessWorld,
  actor: string
): Promise<PuzzleFixture> {
  const known = theKnownPuzzle(gameOf(w));
  if (!w.memo.has(KNOWN_ONLY)) {
    for (const other of knownPuzzlesOf(gameOf(w)))
      if (other.record.id !== known.record.id)
        await w.s.apply(retireCataloguePuzzle, other.record.id);
    w.memo.set(KNOWN_ONLY, true);
  }
  const id = await enterPuzzles(w, actor);
  // Precondition guard: the feed served the game's known puzzle.
  if (id !== known.record.id)
    throw new Error(`${actor} was served ${id}, not ${known.record.id}`);
  return known;
}

/**
 * Bring `actor`'s board into view for a `Then` that reads it: back to the
 * game's puzzles in their space, or into a space of their own when they are
 * in none (a person just signed in).
 */
export async function focusPuzzle(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(focusActor, actor);
  if (await w.s.read(isPuzzleScreenShown, actor)) return;
  if (await w.s.read(isPuzzleStatsShown, actor))
    await w.s.apply(leaveGamePuzzleStats, actor);
  if (!(await w.s.read(activeSpaceVisible, actor))) {
    await openPuzzles(w, actor);
    return;
  }
  await w.s.apply(goBackToGamePuzzles, actor);
}

/** The puzzle rating `actor`'s stats show, once they show one. */
export async function ratingOf(
  w: HarnessWorld,
  actor: string
): Promise<number> {
  await focusStats(w, actor);
  return required(
    await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown !== null,
    }),
    `${actor}'s puzzle rating`
  );
}

/** The game's puzzle stats on `actor`'s device, for a `Then` reading them. */
export async function focusStats(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(showGamePuzzleStats, actor, puzzleGameId(w));
}

// ------------------------------------------------------- the board before

const boardBeforeKey = (actor: string) => `puzzle-board-before:${actor}`;

/** Note the position on `actor`'s board, for "the board is unchanged". */
export async function rememberBoard(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  w.memo.set(
    boardBeforeKey(actor),
    required(await w.s.read(readPuzzleBoardPosition, actor), `${actor}'s board`)
  );
}

/** The position {@link rememberBoard} noted on `actor`'s board. */
export function boardBefore(w: HarnessWorld, actor: string): string {
  return required(
    w.memo.get(boardBeforeKey(actor)) as string | undefined,
    `${actor}'s board before`
  );
}

// ------------------------------------------------------ whose move it is

/** The solver is to move on `actor`'s board: the puzzle takes their move. */
export async function solverToMove(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await focusPuzzle(w, actor);
  const probe = await w.s.until((surf) => readPuzzleProbe(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (seen) => seen?.interactive === true,
  });
  expect(probe?.status).toBe('solving');
}

/** `actor`'s board takes no move. */
export async function boardTakesNoMove(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await focusPuzzle(w, actor);
  expect((await w.s.read(readPuzzleProbe, actor))?.interactive).toBe(false);
}

// ------------------------------------------------------------- the pool

/** Memo key: the puzzles `actor` failed, in the order played. */
export const failedPuzzlesKey = (actor: string) => `puzzle-failed:${actor}`;

/** "A theme of the game's known puzzle", as the feed can be limited to it. */
export function feedTheme(w: HarnessWorld): string {
  return chosenFeedTheme(gameOf(w));
}

/** The run's game's pool is exactly `pool`, made of its known puzzles. */
export async function writePool(
  w: HarnessWorld,
  pool: readonly PoolPuzzle[]
): Promise<void> {
  await w.s.apply(writeKnownPuzzlePool, puzzleGameId(w), pool);
}

/** The ids of every puzzle in the run's game's pool. */
export async function poolIds(w: HarnessWorld): Promise<readonly string[]> {
  return w.s.read(readCataloguePuzzles, puzzleNamespaceOfGame(gameOf(w)));
}

/** `themes` with `theme`, or without it. */
export function themesWith(
  themes: readonly string[],
  theme: string,
  included: boolean
): readonly string[] {
  const others = themes.filter((candidate) => candidate !== theme);
  return included ? [theme, ...others] : others;
}

const themedKey = 'puzzle-pool:themed';

/** Note the pool's puzzles with the theme the scenario names. */
export function rememberThemed(w: HarnessWorld, ids: readonly string[]): void {
  w.memo.set(themedKey, ids);
}

/** The pool's puzzles with the theme the scenario names. */
export function themedPuzzles(w: HarnessWorld): readonly string[] {
  return required(
    w.memo.get(themedKey) as readonly string[] | undefined,
    'a pool with the theme'
  );
}

/**
 * The game's known puzzle, alone in the pool and rated `rating`, on
 * `actor`'s board.
 */
export async function enterKnownPuzzleRated(
  w: HarnessWorld,
  actor: string,
  rating: number
): Promise<void> {
  const known = theKnownPuzzle(gameOf(w));
  await writePool(w, [{ id: known.record.id, rating }]);
  const id = await enterPuzzles(w, actor);
  // Precondition guard: the feed served it.
  if (id !== known.record.id)
    throw new Error(`${actor} was served ${id}, not ${known.record.id}`);
}

/**
 * The puzzle the feed puts on `device`'s board, once the solver may play
 * it and `pred` holds of it, noted as "that puzzle".
 */
export async function servedPuzzle(
  w: HarnessWorld,
  device: string,
  pred: (id: string) => boolean = () => true
): Promise<string> {
  await focusPuzzle(w, device);
  await w.s.until(
    async (surf) => ({
      id: await readPuzzleOnBoard(surf, device),
      probe: await readPuzzleProbe(surf, device),
    }),
    {
      maxMs: SETTLE_MS,
      pred: (seen) =>
        seen.id !== null && seen.probe?.status === 'solving' && pred(seen.id),
    }
  );
  return trackPuzzle(w, device);
}

/** The catalogue's own rating of `puzzleId`. */
export async function ownRatingOf(
  w: HarnessWorld,
  puzzleId: string
): Promise<number> {
  return required(
    await w.s.read(readCataloguePuzzle, puzzleId),
    `${puzzleId} in the pool`
  ).rating;
}

/**
 * The game's puzzles on `actor`'s other device, in the space `actor`'s
 * account hosts; the other device.
 */
export async function otherDevicePuzzles(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  const device = otherDevice(actor);
  const link = required(await w.s.read(readSpaceLink, actor), 'a space');
  await w.s.apply(reopenSpaceLink, device, link);
  await w.s.apply(openGamePuzzlesNoWait, device, puzzleGameId(w));
  return device;
}

// ------------------------------------------------------------ the sounds

const heardKey = (actor: string) => `puzzle-sounds-heard:${actor}`;

/**
 * Note how many of the run's game's puzzle sounds `actor`'s device has
 * played so far, so a later step hears only what followed.
 */
export async function noteSoundsSoFar(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  w.memo.set(
    heardKey(actor),
    (await w.s.read(readPuzzleSoundsPlayed, actor, puzzleGameId(w))).length
  );
}

/** How many puzzle sounds `actor` had heard when last noted. */
export function soundsNoted(w: HarnessWorld, actor: string): number {
  return required(
    w.memo.get(heardKey(actor)) as number | undefined,
    `a note of what ${actor} had heard`
  );
}
