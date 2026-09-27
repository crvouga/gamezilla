/**
 * What the chess steps share: the puzzle each actor is on (and the one
 * before it), the puzzles a pass through the pool served, the actor's puzzle
 * owner, and the common ways into a puzzle. No step definitions here.
 */

import { expect } from 'bun:test';

import {
  closePuzzleFeedSettings,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  setPuzzleFeedTheme,
} from '@libs/chess/sim/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess/sim/chess-puzzle-data';
import { readPuzzlePlayerId } from '@libs/chess/sim/chess-puzzle-ledger-data';
import { readPuzzleBoardProbe } from '@libs/chess/sim/chess-puzzle-solve-ui';
import {
  isPuzzleAttemptRated,
  readActivePuzzleId,
} from '@libs/chess/sim/chess-puzzle-ui';
import { chessGameMenuVisible } from '@libs/chess/sim/chess-ui-reads';
import { focusActor, partition } from '@libs/sim-harness';
import type { Actor, SimWorld } from '@libs/sim-harness/spec/define';
import { recall, remember } from '@libs/sim-harness/spec/world';
import { caps, visible } from '@libs/sim-harness/system/observations';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { hostLimit } from '@pkgs/gherkin/registry';
import { ActionNotEnabled } from '@pkgs/sim';
import type { NamedPuzzle } from './puzzle-fixtures';

export const SECOND_MS = 1_000;
/** Memo key: the puzzles a scenario's pool can serve. */
export const SERVABLE_KEY = 'servablePuzzles';
/** How long a puzzle screen may take to settle when a step names no time. */
export const SETTLE_MS = 20_000;

export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

export function recalled<T>(w: SimWorld, key: string): T {
  return recall(w, key) as T;
}

export function recalledOr<T>(w: SimWorld, key: string, fallback: T): T {
  return w.memo.has(key) ? (w.memo.get(key) as T) : fallback;
}

// ------------------------------------------------------------ the puzzle on

const currentKey = (actor: Actor) => `puzzle:${actor}`;
const previousKey = (actor: Actor) => `previousPuzzle:${actor}`;
const LAST_PUZZLE = 'lastPuzzle';
const LAST_PLAYER = 'lastPlayer';

/** The puzzle on the actor's board right now; fails when there is none. */
export async function activePuzzle(w: SimWorld, actor: Actor): Promise<string> {
  return required(
    await w.s.read(readActivePuzzleId, actor),
    `a puzzle on ${actor}'s board`
  );
}

/**
 * Note the puzzle now on the actor's board as "that puzzle", and the one it
 * replaced as "the one before".
 */
export async function trackPuzzle(w: SimWorld, actor: Actor): Promise<string> {
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
export function currentPuzzle(w: SimWorld, actor: Actor): string {
  return recalled<string>(w, currentKey(actor));
}

/** "The one before": the puzzle the last move-on replaced. */
export function previousPuzzle(w: SimWorld, actor: Actor): string | null {
  return recalledOr<string | null>(w, previousKey(actor), null);
}

/** Whose puzzle a step means when it names no one: the last one tracked. */
export function lastPlayer(w: SimWorld): Actor {
  return recalled<Actor>(w, LAST_PLAYER);
}

/** The puzzle a step names without naming whose it is. */
export function lastPuzzle(w: SimWorld): string {
  return recalled<string>(w, LAST_PUZZLE);
}

// ------------------------------------------------------- a pass through pool

export type ServedPuzzle = { readonly id: string; readonly rated: boolean };

const passKey = (actor: Actor) => `pass:${actor}`;

/** Record the puzzle on the board as served in the current pass. */
export async function recordServed(
  w: SimWorld,
  actor: Actor
): Promise<ServedPuzzle> {
  const id = await activePuzzle(w, actor);
  const rated = (await w.s.read(isPuzzleAttemptRated, actor)) === true;
  const served = { id, rated };
  remember(w, passKey(actor), [...servedInPass(w, actor), served]);
  return served;
}

/** The puzzles the actor was served while passing through the pool. */
export function servedInPass(
  w: SimWorld,
  actor: Actor
): readonly ServedPuzzle[] {
  return recalledOr<readonly ServedPuzzle[]>(w, passKey(actor), []);
}

// ------------------------------------------------------------------ owners

const ownerKey = (actor: Actor) => `puzzleOwner:${actor}`;

/**
 * Whose puzzle progress the actor's device records, fixed the first time a
 * step asks (a guest's device owner stays the answer after sign-in).
 */
export async function puzzleOwner(w: SimWorld, actor: Actor): Promise<string> {
  if (w.memo.has(ownerKey(actor))) return recalled<string>(w, ownerKey(actor));
  const owner = required(
    await w.s.read(readPuzzlePlayerId, actor),
    `${actor}'s puzzle owner`
  );
  return remember(w, ownerKey(actor), owner);
}

/** The actor's second device, as `{actor}'s account opens on another device` names it. */
export function otherDevice(actor: Actor): string {
  return `${actor}_phone`;
}

// --------------------------------------------------------- into the puzzle

/** Open puzzles in the actor's space, creating one when they have none. */
export async function enterPuzzles(w: SimWorld, actor: Actor): Promise<string> {
  await w.s.apply(focusActor, actor);
  if (!(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(createSpace, actor);
  }
  await w.s.apply(openPuzzleFromSpace, actor);
  return trackPuzzle(w, actor);
}

/** The solver may move: the attempt is live and the board unlocked. */
export async function waitSolverToMove(
  w: SimWorld,
  actor: Actor
): Promise<void> {
  await w.s.until(async (surf) => readPuzzleBoardProbe(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (probe) => probe?.interactive === true,
  });
}

/** Serve exactly `puzzle`: seed it when needed and narrow the feed to it. */
export async function enterNamedPuzzle(
  w: SimWorld,
  actor: Actor,
  puzzle: NamedPuzzle
): Promise<void> {
  if (puzzle.csv !== null) await w.s.apply(ingestChessPuzzleCsv, puzzle.csv);
  await enterPuzzles(w, actor);
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedTheme, actor, puzzle.theme);
  await w.s.apply(closePuzzleFeedSettings, actor);
  await w.s.until(async (surf) => readActivePuzzleId(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (id) => id === puzzle.id,
  });
  await trackPuzzle(w, actor);
  await waitSolverToMove(w, actor);
}

/** The stats screen, reached from the puzzle when it is not already open. */
export async function ensureStatsOpen(
  w: SimWorld,
  actor: Actor
): Promise<void> {
  await w.s.apply(focusActor, actor);
  if (await w.s.read(visible, actor, [Handles.chessStatsElo])) return;
  if (!(await w.s.read(chessGameMenuVisible, actor))) {
    await w.s.apply(leavePuzzleToChessMenu, actor);
  }
  await w.s.apply(openChessStatsScreen, actor);
}

/**
 * Cut the actor's connection. A live browser (`SIM_MODE=real|stack`) cannot
 * cut its own: the host lacks `partition`, which is a harness limit, so the
 * scenario ends there instead of failing (as the shared step does).
 */
export async function cutConnection(w: SimWorld, actor: Actor): Promise<void> {
  if (!(await w.s.read(caps)).includes('partition')) {
    const refused = await w.s.apply(partition, actor).then(
      () => null,
      (error: unknown) => error
    );
    expect(refused).toBeInstanceOf(ActionNotEnabled);
    throw hostLimit('this host cannot cut the connection');
  }
  await w.s.apply(partition, actor);
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
