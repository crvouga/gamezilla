/**
 * The custom game under way, for the steps every game shares with matched
 * games: its draw offer and a move the game refuses, each read or made as
 * the custom game's participants do.
 */

import { expect } from 'bun:test';
import { attemptCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { current, identityOf } from './custom-game-set-up-world';
import { turnGameOf, view } from './game-world';

/** `actor` sees a draw offer from the other participant. */
export async function offeredCustomGameDraw(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  const by = (await view(w, actor)).current?.drawOfferedBy ?? '';
  expect(by).not.toBe('');
  expect(by).not.toBe(await identityOf(w, actor));
}

/** Nobody is offered a draw in the custom game. */
export async function noCustomGameDrawOffer(w: HarnessWorld): Promise<void> {
  expect((await current(w)).drawOfferedBy).toBe('');
}

/**
 * `actor` makes a move the game refuses, sent as a modified device would,
 * since the board offers no way to make it.
 */
export async function refusedCustomGameMove(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  const refused = turnGameOf(w).fixtures.refusedOpenings[0];
  if (refused === undefined)
    throw new Error(`${turnGameOf(w).label} names no move its rules refuse`);
  const ply = (await view(w, actor)).current?.moves.length ?? 0;
  await w.s.apply(attemptCustomGame, actor, {
    operation: 'move',
    uci: refused,
    ply,
  });
}
