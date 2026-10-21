/**
 * A device of a matched game's person losing its connection and getting it
 * back, whichever game it is: what the device knew last is remembered as its
 * last known board, and finding an opponent shows that it is offline.
 */

import { expect } from 'bun:test';
import {
  inMatchedGame,
  matchedGameOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { openFindingAnOpponentIfAny } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';

const lastKnownKey = (actor: string) => `multiplayer:offline-board:${actor}`;

/** Whether the scenario has a matched game or a search for `actor` to keep. */
export function playsMatchedGames(w: HarnessWorld, actor: string): boolean {
  return inMatchedGame(w) || w.memo.has(`multiplayer:searching:${actor}`);
}

/** The board `actor`'s device holds now, kept as the one it last knew. */
export async function rememberLastKnownBoard(w: HarnessWorld, actor: string) {
  if (w.memo.has(lastKnownKey(actor))) return;
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game !== null) w.memo.set(lastKnownKey(actor), game);
}

/** The board `actor`'s device held when it lost its connection. */
export function lastKnownBoard(
  w: HarnessWorld,
  actor: string
): MultiplayerGame {
  const game = w.memo.get(lastKnownKey(actor)) as MultiplayerGame | undefined;
  if (game === undefined) throw new Error(`${actor}'s device knew no board`);
  return game;
}

/**
 * `actor`'s device loses its connection while showing finding an opponent:
 * its board is remembered, and it shows it is offline.
 */
export async function deviceOffline(w: HarnessWorld, actor: string) {
  await w.s.apply(openFindingAnOpponentIfAny, actor, gameOf(w).shared.id);
  await rememberLastKnownBoard(w, actor);
  await w.s.apply(setMultiplayerConnection, actor, false);
  await w.s.until((s) => multiplayerText(s, actor, 'multiplayer-offline'), {
    pred: (shown) => shown !== null,
  });
}

/** `actor`'s device still shows the board it held when it went offline. */
export async function keepsLastKnownBoard(w: HarnessWorld, actor: string) {
  expect(await matchedGameOf(w, actor)).toEqual(lastKnownBoard(w, actor));
}
