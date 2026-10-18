/**
 * What the chess steps share: the puzzle each actor is on (and the one
 * before it), the puzzles a pass through the pool served, the actor's puzzle
 * owner, and the common ways into a puzzle. No step definitions here.
 */

import { openPuzzleByTheme } from '@libs/chess-puzzle-harness/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readPuzzlePlayerId } from '@libs/chess-puzzle-harness/chess-puzzle-ledger-data';
import { readPuzzleBoardProbe } from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import type { NamedPuzzle } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import type { StockedPuzzle } from '@libs/chess-puzzle-harness/puzzle-pool-stock';
import {
  GOOD_PUZZLE,
  stockedPuzzleId,
  stockPuzzles,
} from '@libs/chess-puzzle-harness/puzzle-pool-stock';
import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { showGamePuzzleStats } from '@libs/game-session-harness/puzzle-records';
import type { PuzzleProbe } from '@libs/game-session-harness/puzzle-screen';
import {
  isPuzzleScreenShown,
  openGamePuzzles,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import type { Actor } from '@libs/harness/parameter-types';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { recall, remember } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness/spaces-ui-reads';

export const SECOND_MS = 1_000;
/** Memo key: the puzzles a scenario's pool can serve. */
export const SERVABLE_KEY = 'servablePuzzles';
/** Where a step remembers the move a person last tried on a board. */
export function lastMoveKey(actor: string): string {
  return `lastMove:${actor}`;
}

/** How long a puzzle screen may take to settle when a step names no time. */
export const SETTLE_MS = 20_000;

export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

export function recalled<T>(w: HarnessWorld, key: string): T {
  return recall(w, key) as T;
}

export function recalledOr<T>(w: HarnessWorld, key: string, fallback: T): T {
  return w.memo.has(key) ? (w.memo.get(key) as T) : fallback;
}

// ------------------------------------------------------------ the device

const deviceKey = (actor: Actor) => `deviceInHand:${actor}`;

/** Note that the actor now uses `device` (theirs, or their other device). */
export function takeUpDevice(w: HarnessWorld, actor: Actor, device: string) {
  remember(w, deviceKey(actor), device);
}

/** The device the actor last acted on: their own unless a step moved them. */
export function deviceInHand(w: HarnessWorld, actor: Actor): string {
  return recalledOr<string>(w, deviceKey(actor), actor);
}

// ------------------------------------------------------------ the puzzle on

const currentKey = (actor: Actor) => `puzzle:${actor}`;
const previousKey = (actor: Actor) => `previousPuzzle:${actor}`;
const LAST_PUZZLE = 'lastPuzzle';
const LAST_PLAYER = 'lastPlayer';

/** The puzzle on the actor's board right now; fails when there is none. */
export async function activePuzzle(
  w: HarnessWorld,
  actor: Actor
): Promise<string> {
  return required(
    await w.s.read(readPuzzleOnBoard, actor),
    `a puzzle on ${actor}'s board`
  );
}

/**
 * Note the puzzle now on the actor's board as "that puzzle", and the one it
 * replaced as "the one before".
 */
export async function trackPuzzle(
  w: HarnessWorld,
  actor: Actor
): Promise<string> {
  const id = await activePuzzle(w, actor);
  remember(
    w,
    previousKey(actor),
    recalledOr<string | null>(w, currentKey(actor), null)
  );
  remember(w, currentKey(actor), id);
  remember(w, LAST_PUZZLE, id);
  remember(w, LAST_PLAYER, actor);
  return id;
}

/** "That puzzle": the one the actor was last seen on. */
export function currentPuzzle(w: HarnessWorld, actor: Actor): string {
  return recalled<string>(w, currentKey(actor));
}

/** "The one before": the puzzle the last move-on replaced. */
export function previousPuzzle(w: HarnessWorld, actor: Actor): string | null {
  return recalledOr<string | null>(w, previousKey(actor), null);
}

/** Whose puzzle a step means when it names no one: the last one tracked. */
export function lastPlayer(w: HarnessWorld): Actor {
  return recalled<Actor>(w, LAST_PLAYER);
}

/** The puzzle last seen on anyone's board, or null before any was. */
export function puzzleOnBoard(w: HarnessWorld): string | null {
  return recalledOr<string | null>(w, LAST_PUZZLE, null);
}

/** The puzzle a step names without naming whose it is. */
export function lastPuzzle(w: HarnessWorld): string {
  return recalled<string>(w, LAST_PUZZLE);
}

/** Memo key: the puzzles the actor failed, in the order played. */
export const failedPuzzlesKey = (actor: Actor) => `failedPuzzles:${actor}`;

// ------------------------------------------------------------------ owners

const ownerKey = (actor: Actor) => `puzzleOwner:${actor}`;

/**
 * Whose puzzle progress the actor's device records, fixed the first time a
 * step asks (a guest's device owner stays the answer after sign-in).
 */
export async function puzzleOwner(
  w: HarnessWorld,
  actor: Actor
): Promise<string> {
  if (w.memo.has(ownerKey(actor))) return recalled<string>(w, ownerKey(actor));
  const owner = required(
    await w.s.read(readPuzzlePlayerId, actor),
    `${actor}'s puzzle owner`
  );
  return remember(w, ownerKey(actor), owner);
}

// --------------------------------------------------------- into the puzzle

/** Open puzzles in the actor's space, creating one when they have none. */
export async function enterPuzzles(
  w: HarnessWorld,
  actor: Actor
): Promise<string> {
  await w.s.apply(focusActor, actor);
  if (!(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(createSpace, actor);
  }
  await w.s.apply(openGamePuzzles, actor, CHESS_GAME_ID);
  return trackPuzzle(w, actor);
}

/** Bring the puzzle feed into view for a `Then` that reads it. */
export async function focusFeed(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  if (!(await w.s.read(isPuzzleScreenShown, actor))) {
    await enterPuzzles(w, actor);
  }
}

/**
 * A `Given` that needs a puzzle on the board builds it: open puzzles unless
 * an earlier step already put the actor on one.
 */
export async function ensureOnPuzzle(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  if (!w.memo.has(currentKey(actor))) await enterPuzzles(w, actor);
}

/** The puzzle the feed puts on `device`'s board, once there is one. */
export async function servedPuzzle(
  w: HarnessWorld,
  device: string,
  pred: (debug: PuzzleProbe) => boolean = () => true
): Promise<PuzzleProbe> {
  await w.s.apply(focusActor, device);
  return required(
    await w.s.until(async (surf) => readPuzzleProbe(surf, device), {
      maxMs: SETTLE_MS,
      pred: (debug) => debug?.status === 'solving' && pred(debug),
    }),
    `a puzzle on ${device}'s board`
  );
}

/** The id of the puzzle the feed puts on `device`'s board. */
export async function servedPuzzleId(
  w: HarnessWorld,
  device: string
): Promise<string> {
  await servedPuzzle(w, device);
  return required(await w.s.read(readPuzzleOnBoard, device), 'a puzzle id');
}

// ------------------------------------------------------------ stocking

const STOCKED_COUNT = 'stockedPuzzleCount';

/**
 * Themes no seeded puzzle carries, one per stocked puzzle a scenario opens
 * by theme, so narrowing the feed to it serves exactly that puzzle.
 */
const OPENING_THEMES: readonly ChessPuzzleTheme[] = [
  'xRayAttack',
  'interference',
  'attraction',
  'deflection',
  'capturingDefender',
  'intermezzo',
];

/** Stock `puzzles` after any stocked earlier in the scenario; their ids. */
export async function stock(
  w: HarnessWorld,
  puzzles: readonly StockedPuzzle[]
): Promise<readonly string[]> {
  const first = recalledOr<number>(w, STOCKED_COUNT, 0);
  await w.s.apply(stockPuzzles, puzzles, first);
  remember(w, STOCKED_COUNT, first + puzzles.length);
  return puzzles.map((_, i) => stockedPuzzleId(first + i));
}

/** Stock one good puzzle rated `rating` and put it on the actor's board. */
export async function enterStockedPuzzle(
  w: HarnessWorld,
  actor: Actor,
  rating: number
): Promise<string> {
  const index = recalledOr<number>(w, STOCKED_COUNT, 0);
  const theme = required(OPENING_THEMES[index], 'a theme to open it by');
  const [id = ''] = await stock(w, [
    { ...GOOD_PUZZLE, rating, themes: [theme] },
  ]);
  await enterNamedPuzzle(w, actor, { id, theme, csv: null });
  return id;
}

// ------------------------------------------------------- the board before

const boardBeforeKey = (actor: Actor) => `boardBefore:${actor}`;

/** Note the position on the actor's board, for "the board is unchanged". */
export async function rememberBoard(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  const probe = required(
    await w.s.read(readPuzzleBoardProbe, actor),
    `${actor}'s board`
  );
  remember(w, boardBeforeKey(actor), probe.fen);
}

/** The position {@link rememberBoard} noted on the actor's board. */
export function boardBefore(w: HarnessWorld, actor: Actor): string {
  return recalled<string>(w, boardBeforeKey(actor));
}

/** The solver may move: the attempt is live and the board unlocked. */
export async function waitSolverToMove(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  await w.s.until(async (surf) => readPuzzleBoardProbe(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (probe) => probe?.interactive === true,
  });
}

/** Serve exactly `puzzle`: seed it when needed and narrow the feed to it. */
export async function enterNamedPuzzle(
  w: HarnessWorld,
  actor: Actor,
  puzzle: NamedPuzzle
): Promise<void> {
  if (puzzle.csv !== null) await w.s.apply(ingestChessPuzzleCsv, puzzle.csv);
  await enterPuzzles(w, actor);
  await w.s.apply(openPuzzleByTheme, actor, puzzle.theme, puzzle.id);
  await trackPuzzle(w, actor);
}

/** The stats screen on `device` (an actor or their other device). */
export async function ensureStatsOpen(
  w: HarnessWorld,
  device: string
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.apply(showGamePuzzleStats, device, CHESS_GAME_ID);
}

/** `a1-a5` → `a1a5`. */
export function uciOf(move: string): string {
  const match = /^([a-h][1-8])-([a-h][1-8])$/.exec(move);
  if (match === null) throw new Error(`not a move: ${move} (expected e2-e4)`);
  return `${match[1] ?? ''}${match[2] ?? ''}`;
}

const PROMOTION_PIECES = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
} as const;

export function promotionPiece(name: string): 'q' | 'r' | 'b' | 'n' {
  const piece = (
    PROMOTION_PIECES as Partial<Record<string, 'q' | 'r' | 'b' | 'n'>>
  )[name];
  if (piece === undefined) {
    throw new Error(
      `cannot promote to a ${name} (queen, rook, bishop, knight)`
    );
  }
  return piece;
}

export function sideOf(name: string): 'w' | 'b' {
  if (name === 'White') return 'w';
  if (name === 'Black') return 'b';
  throw new Error(`not a side: ${name} (White or Black)`);
}
