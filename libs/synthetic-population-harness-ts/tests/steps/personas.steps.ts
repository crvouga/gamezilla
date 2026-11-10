import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { givenClosedAfterDay } from '@libs/synthetic-population-harness-ts/daily-rhythm-actions';
import {
  givenSyntheticPopulationOf,
  personaComplete,
  personasSeen,
  populationUsernames,
} from '@libs/synthetic-population-harness-ts/persona-observations';
import { syntheticPersonaOf } from '@libs/synthetic-population-harness-ts/synthetic-user-reads';
import { recallContinuity, rememberContinuity } from './continuity-memo';

const MINUTE_MS = 60_000;

Given(
  'the Synthetic Population has {int} Synthetic Users',
  async (w, count: number) => {
    await w.s.apply(givenSyntheticPopulationOf, count);
  }
);
Given(
  'the Synthetic User {string} closed the app once its daily schedule was over yesterday',
  async (w, name: string) => {
    await w.s.apply(givenClosedAfterDay, name);
    await rememberContinuity(w);
  }
);
Then(
  '{actor} sees a new Synthetic User with a complete persona within {int} minute',
  async (w, actor: Actor, minutes: number) => {
    await w.s.until((s) => personasSeen(s, actor), {
      pred: (seen) => seen.some(personaComplete),
      maxMs: minutes * MINUTE_MS,
      stepMs: 1000,
    });
  }
);
Then(
  '{actor} sees {int} Synthetic Users, each with a different username',
  async (w, actor: Actor, count: number) => {
    const seen = await w.s.read(personasSeen, actor);
    expect(seen).toHaveLength(count);
    expect(new Set(seen.map((user) => user.username)).size).toBe(count);
  }
);
Then(
  'no three Synthetic User usernames begin with the same three letters',
  async (w) => {
    const usernames = await w.s.read(populationUsernames);
    const prefixes = usernames.map((name) => name.slice(0, 3).toLowerCase());
    for (const prefix of prefixes)
      expect(prefixes.filter((other) => other === prefix).length).toBeLessThan(
        3
      );
  }
);
Then('no two Synthetic User usernames differ only by a number', async (w) => {
  const usernames = await w.s.read(populationUsernames);
  const stems = usernames.map((name) => name.replace(/[0-9]/g, ''));
  expect(new Set(stems).size).toBe(usernames.length);
});
Then(
  '{actor} sees Synthetic Users of at least {int} different skill levels',
  async (w, actor: Actor, least: number) => {
    const seen = await w.s.read(personasSeen, actor);
    const levels = new Set(seen.map((user) => user.persona?.skillLevel));
    levels.delete(undefined);
    expect(levels.size).toBeGreaterThanOrEqual(least);
  }
);
Then(
  '{actor} sees at least {int} different favorite games among the Synthetic Users',
  async (w, actor: Actor, least: number) => {
    const seen = await w.s.read(personasSeen, actor);
    const games = new Set(seen.flatMap((user) => user.favoriteGamesShown));
    expect(games.size).toBeGreaterThanOrEqual(least);
  }
);
Then(
  'the Synthetic User {string} keeps its persona',
  async (w, name: string) => {
    const before = recallContinuity(w).persona;
    expect(before).not.toBeNull();
    expect(await w.s.read(syntheticPersonaOf, name)).toEqual(before);
  }
);
