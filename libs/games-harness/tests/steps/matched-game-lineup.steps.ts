/**
 * What finding an opponent shows a person: how long their search has run,
 * and once paired, who they play, at which clock choice and on which side,
 * named as the game itself names its sides.
 */

import { expect } from 'bun:test';
import { ownerOf } from '@libs/game-matchmaking-harness/matched-game-world';
import {
  shownMultiplayerLineup,
  shownMultiplayerSearch,
} from '@libs/game-matchmaking-harness/multiplayer-presentation';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { timeControlOf } from '@libs/game-matchmaking-shared/time-control';
import { Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { nameEveryoneSeesOf } from '@libs/profile-harness/profile-ui-reads';
import { clockShown, daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';

/** How the game names `side` to a person. */
function sideName(w: HarnessWorld, side: 'white' | 'black'): string {
  const presentation = gameOf(w).client.presentation;
  if (presentation === undefined)
    throw new Error(`${gameOf(w).label} has no board to name its sides`);
  return presentation.sideLabel(side);
}

/** `viewer` sees `opponent`, the clock choice, the rating and their side. */
async function pairedAs(
  w: HarnessWorld,
  people: { readonly viewer: string; readonly opponent: string },
  expected: {
    readonly clock: string;
    readonly speed: string;
    readonly rating: string;
  }
) {
  expect(String(timeControlOf(expected.clock)?.speed)).toBe(expected.speed);
  const { viewer, opponent } = people;
  await w.s.apply(openFindingAnOpponent, viewer, gameOf(w).shared.id);
  await w.s.until(
    (s) => shownMultiplayerText(s, viewer, 'multiplayer-opponent'),
    { pred: (shown) => shown !== null }
  );
  const lineup = await w.s.read(shownMultiplayerLineup, viewer);
  const game = (await w.s.read(multiplayerView, viewer)).game!;
  const side = game.white_id === (await ownerOf(w, viewer)) ? 'white' : 'black';
  expect(lineup.opponent).toContain(
    String(await w.s.read(nameEveryoneSeesOf, opponent))
  );
  expect(lineup.opponent).toContain(`(${expected.rating})`);
  expect(lineup.timeControl).toBe(clockShown(expected.clock));
  expect(lineup.colour).toBe(`You play ${sideName(w, side)}`);
}

Then(
  '{actor} sees {actor} as her/his opponent at {word}, with a {word} rating of {string} and her/his side',
  (
    w,
    ...[viewer, opponent, clock, speed, rating]: [
      string,
      string,
      string,
      string,
      string,
    ]
  ) => pairedAs(w, { viewer, opponent }, { clock, speed, rating })
);
Then(
  '{actor} sees {actor} as her/his opponent at {int} day(s) per move, with a {word} rating of {string} and her/his side',
  (
    w,
    ...[viewer, opponent, days, speed, rating]: [
      string,
      string,
      number,
      string,
      string,
    ]
  ) => pairedAs(w, { viewer, opponent }, { clock: daily(days), speed, rating })
);
Then('{actor} is not shown an opponent', async (w, actor: string) => {
  await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
  expect(
    await w.s.read(shownMultiplayerText, actor, 'multiplayer-opponent')
  ).toBeNull();
});
Then(
  '{actor} sees she has been waiting for an opponent at {word} for {int} seconds',
  async (w, actor: string, clock: string, seconds: number) => {
    await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
    const search = await w.s.read(shownMultiplayerSearch, actor);
    expect(search.message).toContain(clock);
    expect(search.elapsedSeconds).toBe(seconds);
  }
);
