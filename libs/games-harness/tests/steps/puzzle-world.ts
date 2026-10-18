/**
 * What the puzzle steps share, for the run's game: its known puzzles (the
 * independent oracle every expected move, position and label comes from),
 * the puzzle each person is on and the one before it, and the ways onto
 * the board and to the stats. No step definitions here.
 */

import { expect } from 'bun:test';
import { rulesTrail } from '@libs/game-session-harness/game-puzzle-laws';
import type { PuzzleFixture } from '@libs/game-session-harness/known-puzzles';
import {
  knownPuzzle,
  knownPuzzlesOf,
  theKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import {
  isPuzzleStatsShown,
  leaveGamePuzzleStats,
  retireCataloguePuzzle,
  showGamePuzzleStats,
} from '@libs/game-session-harness/puzzle-records';
import {
  goBackToGamePuzzles,
  isPuzzleScreenShown,
  openGamePuzzles,
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness/spaces-ui-reads';
import { gameOf } from './game-world';

export const SECOND_MS = 1_000;
/** How long a puzzle screen may take to settle when a step names no time. */
export const SETTLE_MS = 20_000;

/** The run's game's id, as its puzzles and choices are found by. */
export function puzzleGameId(w: HarnessWorld): string {
  return gameOf(w).shared.id;
}

function required<T>(value: T | null | undefined, what: string): T {
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

/** Open the game's puzzles in `actor`'s space, starting one if needed. */
export async function enterPuzzles(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  await w.s.apply(focusActor, actor);
  if (!(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(createSpace, actor);
  }
  await w.s.apply(openGamePuzzles, actor, puzzleGameId(w));
  return trackPuzzle(w, actor);
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

/** Bring `actor`'s board into view for a `Then` that reads it. */
export async function focusPuzzle(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(focusActor, actor);
  if (await w.s.read(isPuzzleScreenShown, actor)) return;
  if (await w.s.read(isPuzzleStatsShown, actor))
    await w.s.apply(leaveGamePuzzleStats, actor);
  await w.s.apply(goBackToGamePuzzles, actor);
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
