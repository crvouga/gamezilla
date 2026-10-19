/**
 * A person seeking an opponent for the run's game: their search, what they
 * are told, and the clock choices finding an opponent offers, each in the
 * game's own clock namespace.
 */

import { expect } from 'bun:test';
import {
  searchFor,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import type { MultiplayerSearchView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { everInASpace } from '@libs/game-matchmaking-harness/multiplayer-spaces';
import {
  findGameOpponent,
  findGameOpponentOutsideSpaces,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import { actOnOtherDevice, readyPeople, timeControlFor } from './matched-game';

/** A daily clock choice (`3d`) as people name it (`3 days per move`). */
export function daily(days: number): string {
  return dailyTimeControlId(days);
}

/** A clock choice as finding an opponent shows it (`5+0`, `3 days per move`). */
export function clockShown(clock: string): string {
  const days = /^(\d+)d$/.exec(clock)?.[1];
  if (days === undefined) return clock;
  return days === '1' ? '1 day per move' : `${days} days per move`;
}

/** `actor` has an account, a space and a search at `clock`. */
export async function seeking(w: HarnessWorld, actor: string, clock: string) {
  await readyPeople(w, [actor]);
  await searchFor(w, actor, timeControlFor(w, clock));
}

/** `actor` seeks an opponent at `clock` from `device` (their phone). */
export async function seek(
  w: HarnessWorld,
  actor: string,
  clock: string,
  device = actor
) {
  actOnOtherDevice(w, actor, device);
  // Someone who left their space is outside every space, not new to them.
  const outside = await w.s.read(everInASpace, device);
  return w.s.apply(
    outside ? findGameOpponentOutsideSpaces : findGameOpponent,
    device,
    gameOf(w).shared.id,
    timeControlFor(w, clock)
  );
}

/** Whether `search` is waiting, at `timeControl` when one is named. */
function waitingAt(
  search: MultiplayerSearchView | null,
  timeControl?: string
): boolean {
  return (
    search?.standing === 'waiting' &&
    (timeControl === undefined || search.time_control === timeControl)
  );
}

/** `actor`'s device shows them waiting, at `clock` when one is named. */
export async function waiting(w: HarnessWorld, actor: string, clock?: string) {
  const device = viewerOf(w, actor);
  const timeControl =
    clock === undefined ? undefined : timeControlFor(w, clock);
  await w.s.until(async (s) =>
    waitingAt((await multiplayerView(s, device)).search, timeControl)
  );
  expect(
    waitingAt((await w.s.read(multiplayerView, device)).search, timeControl)
  ).toBe(true);
}

/** `actor` is not waiting for an opponent, on the device they look at. */
export async function notWaiting(w: HarnessWorld, actor: string) {
  const { search } = await w.s.read(multiplayerView, viewerOf(w, actor));
  expect(search?.standing ?? null).not.toBe('waiting');
}

/** `actor`'s device still holds the search the scenario gave them. */
export async function sameSearch(w: HarnessWorld, device: string) {
  const original = w.memo.get('multiplayer:original-search');
  if (original === undefined) throw new Error('No search was set up');
  await w.s.until(async (s) =>
    waitingAt((await multiplayerView(s, device)).search)
  );
  expect((await w.s.read(multiplayerView, device)).search).toEqual(
    original as MultiplayerSearchView
  );
}
