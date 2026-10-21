/**
 * One search and one matched game follow the person to every device and
 * space; another device, even in someone else's space, starts neither.
 */

import { expect } from 'bun:test';
import {
  matchedGameOf,
  sameBoards,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { multiplayerSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { returnToTabs } from '@libs/harness-ts/auth-actions';
import { Given, Then } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { sameSearch, seeking } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { otherDevice, pairedAt, readyPeople, seenOn } from './matched-game';

/** The device the scenario's search is checked on: the phone, unless named. */
function searchDevice(w: HarnessWorld, actor: string): string {
  return String(w.memo.get(`finding-an-opponent:search-on:${actor}`) ?? actor);
}

Given(
  '{actor} is hosting a space and seeking an opponent for the game at {word}',
  async (w, actor: string, clock: string) => {
    await seeking(w, actor, clock);
    expect(await w.s.read(multiplayerSpaceId, actor)).not.toBeNull();
  }
);
Given(
  "{actor}'s other device is in {actor}'s space",
  async (w, actor: string, host: string) => {
    // The host's space plays the game, so its guests see its choices.
    await readyPeople(w, [host]);
    await w.s.apply(openFindingAnOpponent, host, gameOf(w).shared.id);
    const device = await otherDevice(w, actor);
    await w.s.apply(returnToTabs, device);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} has no space`);
    await w.s.apply(joinViaLink, device, link);
    w.memo.set(`finding-an-opponent:search-on:${actor}`, device);
  }
);
Given(
  '{actor} and {actor} have a matched game in different spaces',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    for (const person of [first, second])
      await w.s.apply(openFindingAnOpponent, person, gameOf(w).shared.id);
  }
);

Then('{actor} sees her same search on that device', (w, actor: string) =>
  sameSearch(w, seenOn(w, actor))
);
Then('{actor} is still waiting with her same search', (w, actor: string) =>
  sameSearch(w, searchDevice(w, actor))
);
Then(
  '{actor} sees the same matched game and board on that device',
  async (w, actor: string) => {
    const device = seenOn(w, actor);
    const paired = w.memo.get('multiplayer:game') as MultiplayerGame;
    expect((await sameBoards(w, actor, device)).id).toBe(paired.id);
    expect(await matchedGameOf(w, device)).toEqual(
      await matchedGameOf(w, actor)
    );
  }
);
