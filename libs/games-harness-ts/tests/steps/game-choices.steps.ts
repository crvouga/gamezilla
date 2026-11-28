import { expect } from 'bun:test';
import {
  goBackInGame,
  offeredGameChoices,
  openGameChoice,
  pickGame,
  SHARED_GAME_CHOICES,
  showsGameScreen,
} from '@libs/game-session-harness-ts/game-navigation';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { gameOf } from './game-world';

const SECOND_MS = 1000;

async function pickedGame(w: HarnessWorld, host: string, guest: string) {
  await w.s.apply(createSpace, host);
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no space`);
  await w.s.apply(openSpaceLink, guest, link);
  await w.s.apply(joinFromPrompt, guest);
  await w.s.apply(pickGame, host, gameOf(w).shared.id);
  await w.s.until((s) => offeredGameChoices(s, guest), {
    pred: (offered) =>
      SHARED_GAME_CHOICES.every((choice) => offered.includes(choice)),
  });
}

Then(
  '{actor} and {actor} are offered separate choices to play a friend, play a bot, find an opponent and see game history',
  async (w, a: string, b: string) => {
    for (const actor of [a, b])
      await w.s.until((s) => offeredGameChoices(s, actor), {
        maxMs: 15 * SECOND_MS,
        pred: (offered) =>
          SHARED_GAME_CHOICES.every((choice) => offered.includes(choice)),
      });
  }
);
Given(
  '{actor} has picked the game for the space {actor} joined',
  async (w, host: string, guest: string) => pickedGame(w, host, guest)
);
Given(
  '{actor} has opened the setup for playing a friend in the space {actor} joined',
  async (w, host: string, guest: string) => {
    await pickedGame(w, host, guest);
    await w.s.apply(openGameChoice, host, 'vs-human');
    await w.s.until((s) => showsGameScreen(s, guest, 'vs-human'), {
      pred: Boolean,
    });
  }
);
When(
  '{actor} opens the setup for playing a friend',
  async (w, actor: string) => {
    await w.s.apply(openGameChoice, actor, 'vs-human');
  }
);
When("{actor} goes back to the game's choices", async (w, actor: string) => {
  await w.s.apply(goBackInGame, actor);
});
Then(
  '{actor} is shown the setup for playing a friend within {int} seconds',
  async (w, actor: string, seconds: number) => {
    expect(
      await w.s.until((s) => showsGameScreen(s, actor, 'vs-human'), {
        maxMs: seconds * SECOND_MS,
        pred: Boolean,
      })
    ).toBe(true);
  }
);
Then(
  "{actor} is shown the game's choices within {int} seconds",
  async (w, actor: string, seconds: number) => {
    expect(
      await w.s.until((s) => showsGameScreen(s, actor, null), {
        maxMs: seconds * SECOND_MS,
        pred: Boolean,
      })
    ).toBe(true);
  }
);
