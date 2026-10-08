import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  shownMultiplayerLineup,
  shownMultiplayerSearch,
} from '@libs/chess-matchmaking-harness/multiplayer-presentation';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import { givenOverGame, ownerOf, searchFor } from './multiplayer-world';

async function matchedAs(
  w: HarnessWorld,
  viewer: string,
  opponent: string,
  expected: { readonly timeControl: string; readonly rating: string }
) {
  await w.s.apply(openMultiplayerChess, viewer);
  await w.s.until(
    async (s) =>
      (await shownMultiplayerText(s, viewer, 'multiplayer-opponent')) !== null
  );
  const shown = await w.s.read(shownMultiplayerLineup, viewer);
  const game = (await w.s.read(multiplayerView, viewer)).game!;
  const white = game.white_id === (await ownerOf(w, viewer));
  expect(shown.opponent).toContain(opponent);
  expect(shown.opponent).toContain(`(${expected.rating})`);
  expect(shown.timeControl).toBe(expected.timeControl);
  expect(shown.colour).toBe(white ? 'You play White' : 'You play Black');
}

Then(
  '{actor} sees {actor} as her multiplayer opponent at {word}, with his blitz rating {string} and her colour',
  (
    w,
    ...[viewer, opponent, timeControl, rating]: [Actor, Actor, string, string]
  ) => matchedAs(w, viewer, opponent, { timeControl, rating })
);
Then(
  '{actor} sees {actor} as his multiplayer opponent at {word}, with her blitz rating {string} and his colour',
  (
    w,
    ...[viewer, opponent, timeControl, rating]: [Actor, Actor, string, string]
  ) => matchedAs(w, viewer, opponent, { timeControl, rating })
);
Then('{actor} is not shown a multiplayer opponent', async (w, actor: Actor) => {
  await w.s.apply(openMultiplayerChess, actor);
  expect(
    await w.s.read(shownMultiplayerText, actor, 'multiplayer-opponent')
  ).toBeNull();
});
Then(
  '{actor} sees she has been looking for a {word} chess opponent for {int} seconds',
  async (w, actor: Actor, timeControl: string, seconds: number) => {
    await w.s.apply(openMultiplayerChess, actor);
    const shown = await w.s.read(shownMultiplayerSearch, actor);
    expect(shown.message).toContain(timeControl);
    expect(shown.elapsedSeconds).toBe(seconds);
  }
);

Given(
  '{actor} played White and {actor} played Black in their only multiplayer games',
  (w, white: Actor, black: Actor) => givenOverGame(w, white, black)
);
Given(
  '{actor} played White in her only multiplayer game and {actor} has played none',
  async (w, white: Actor, newcomer: Actor) => {
    await givenOverGame(w, white, 'carol');
    await multiplayerPeople(w, [newcomer]);
  }
);
Given(
  '{actor} and {actor} each played White in their only multiplayer game',
  async (w, first: Actor, second: Actor) => {
    await givenOverGame(w, first, 'carol');
    await givenOverGame(w, second, 'dave');
  }
);
Given(
  '{actor} began looking for a {word} chess opponent before {actor} did',
  async (w, first: Actor, timeControl: string, second: Actor) => {
    await searchFor(w, first, timeControl);
    await w.s.advanceTime(1000);
    await searchFor(w, second, timeControl);
  }
);
Then(
  '{actor} is Black and {actor} is White in their new multiplayer game',
  async (w, black: Actor, white: Actor) => {
    const whiteId = await ownerOf(w, white);
    const blackId = await ownerOf(w, black);
    const fresh = (
      game: { white_id: string; black_id: string; outcome: string } | null
    ) =>
      game?.white_id === whiteId &&
      game.black_id === blackId &&
      game.outcome === 'ongoing';
    await w.s.until(
      async (s) =>
        fresh((await multiplayerView(s, white)).game) &&
        fresh((await multiplayerView(s, black)).game)
    );
    expect((await w.s.read(multiplayerView, black)).game).toEqual(
      (await w.s.read(multiplayerView, white)).game
    );
  }
);
Then(
  'both people see their multiplayer game is played at {word}',
  async (w, timeControl: string) => {
    for (const actor of ['alice', 'bob']) {
      await w.s.apply(openMultiplayerChess, actor);
      await w.s.until(
        async (s) =>
          (await shownMultiplayerText(s, actor, 'multiplayer-time-control')) ===
          timeControl
      );
      expect((await w.s.read(multiplayerView, actor)).game?.time_control).toBe(
        timeControl
      );
    }
  }
);
