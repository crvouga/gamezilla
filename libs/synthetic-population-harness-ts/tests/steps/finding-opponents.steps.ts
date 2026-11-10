import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  lookForMultiplayerOpponent,
  lookingForOpponent,
  multiplayerOpponentShown,
  stillLookingShown,
} from '@libs/synthetic-population-harness-ts/opponent-finding-actions';
import {
  givenEverySyntheticUserPaused,
  givenFinishedGameAgainst,
} from '@libs/synthetic-population-harness-ts/synthetic-population-fixtures';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';

const SECOND_MS = 1000;

Given(
  'nobody else is looking for a multiplayer opponent for {string}',
  async (w, game: string) => {
    expect(await w.s.read(lookingForOpponent, game)).toBe(0);
  }
);
Given('every Synthetic User is paused', async (w) => {
  await w.s.apply(givenEverySyntheticUserPaused);
});
Given(
  'the Synthetic Users {string} and {string} are available',
  async (w, first: string, second: string) => {
    await w.s.apply(givenSyntheticUser, first, false);
    await w.s.apply(givenSyntheticUser, second, false);
  }
);
Given(
  '{string} is the only Synthetic User available',
  async (w, name: string) => {
    await w.s.apply(givenSyntheticUser, name, false);
  }
);
Given(
  "{actor}'s latest multiplayer opponent for {string} was {string}",
  async (w, _actor: Actor, game: string, name: string) => {
    await w.s.apply(givenFinishedGameAgainst, game, name);
  }
);
When(
  '{actor} looks for a multiplayer opponent for {string}',
  async (w, actor: Actor, game: string) => {
    await w.s.apply(lookForMultiplayerOpponent, actor, game);
  }
);
Then(
  "{actor}'s multiplayer opponent is {string} within {int} seconds",
  async (w, actor: Actor, name: string, seconds: number) => {
    const shown = await w.s.until((s) => multiplayerOpponentShown(s, actor), {
      pred: (found) => found !== null,
      maxMs: seconds * SECOND_MS,
    });
    expect(shown?.opponent).toBe(name);
    expect(shown?.afterMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      seconds * SECOND_MS
    );
  }
);
Then(
  '{actor} is still looking for a multiplayer opponent for {string} {int} seconds later',
  async (w, actor: Actor, game: string, seconds: number) => {
    const shown = await w.s.until((s) => stillLookingShown(s, actor), {
      pred: (looking) => !looking.looking || looking.seconds >= seconds,
      maxMs: seconds * SECOND_MS,
    });
    expect(shown.looking).toBe(true);
    expect(shown.told).toContain(game);
  }
);
Then(
  '{actor} is told he is still looking for a multiplayer opponent',
  async (w, actor: Actor) => {
    const shown = await w.s.read(stillLookingShown, actor);
    expect(shown.told).toContain('Looking for');
  }
);
