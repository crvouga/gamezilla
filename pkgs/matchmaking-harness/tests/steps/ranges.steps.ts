import { expect } from 'bun:test';
import { deviceRange } from '@pkgs/matchmaking-harness/devices';
import {
  changeRange,
  repeatChange,
  stopWaiting,
  timePasses,
} from '@pkgs/matchmaking-harness/lobby';
import { lastUpdate } from '@pkgs/matchmaking-harness/observations';
import { waitsForMatch } from './matchmaking.steps';
import type { MatchmakingWorld } from './world';
import { Given, Then, When } from './world';

Given(
  '{actor} is waiting with a range of {int} points',
  async (w, person: string, range: number) =>
    waitsForMatch(w, person, { range })
);
Given(
  '{actor} is waiting again with a range of {int} points',
  async (w, person: string, range: number) =>
    waitsForMatch(w, person, { range })
);
Given(
  '{actor} is waiting with a range of {int} points and has waited {int} seconds',
  async (w, person: string, range: number, seconds: number) => {
    await waitsForMatch(w, person, { range });
    await w.harness.apply(timePasses, seconds);
  }
);
Given(
  '{actor} and {actor} are waiting with ratings {int} points apart',
  async (w, a: string, b: string, difference: number) => {
    await waitsForMatch(w, a, { rating: 1000, range: 200 });
    await waitsForMatch(w, b, { rating: 1000 + difference, range: 200 });
  }
);
Given(
  '{actor} and {actor} have growing ranges and ratings {int} points apart',
  async (w, a: string, b: string, difference: number) => {
    await waitsForMatch(w, a, { rating: 1000, range: -1 });
    await waitsForMatch(w, b, { rating: 1000 + difference, range: -1 });
  }
);
Given(
  'both accept nobody more than {int} points away',
  async (w, range: number) => {
    for (const person of ['alice', 'bob'])
      await w.harness.apply(changeRange, { person, range });
  }
);
Given('both have been waiting for {int} seconds', async (w, seconds: number) =>
  w.harness.apply(timePasses, seconds)
);
When('{int} second(s) pass(es)', async (w, seconds: number) =>
  w.harness.apply(timePasses, seconds)
);
When('a day passes', async (w) => w.harness.apply(timePasses, 86400));

async function growingStopped(
  w: MatchmakingWorld,
  person: string,
  seconds: number
): Promise<void> {
  await waitsForMatch(w, person, { rating: 1000, range: -1 });
  await w.harness.apply(timePasses, seconds);
  await w.harness.apply(stopWaiting, { person });
}
Given('{actor} stopped a growing wait after {int} seconds', growingStopped);
Given('{actor} has a new growing wait', async (w, person: string) =>
  waitsForMatch(w, person, { rating: 1000, range: -1 })
);
When('{actor} waits with a growing range again', async (w, person: string) =>
  waitsForMatch(w, person, { rating: 1000, range: -1 })
);
Given(
  '{actor} is waiting with a rating {int} points above {actor}',
  async (w, person: string, points: number) =>
    waitsForMatch(w, person, { rating: 1000 + points, range: -1 })
);

When(
  '{actor} narrows her/his range to {int} points',
  async (w, person: string, range: number) =>
    w.harness.apply(changeRange, { person, range })
);
Given(
  '{actor} narrowed her/his range to {int} points',
  async (w, person: string, range: number) =>
    w.harness.apply(changeRange, { person, range })
);
Given(
  '{actor} widened her/his waiting range to {int} points',
  async (w, person: string, range: number) => {
    await waitsForMatch(w, person, { range: 5 });
    await w.harness.apply(changeRange, { person, range });
  }
);
Given(
  '{actor} then narrowed the same wait to {int} points',
  async (w, person: string, range: number) =>
    w.harness.apply(changeRange, { person, range })
);
When('{actor} repeats that range change', async (w, person: string) =>
  w.harness.apply(repeatChange, { person })
);
When(
  '{actor} repeats her/his earlier wide range change',
  async (w, person: string) => w.harness.apply(repeatChange, { person })
);
Given('{actor} stopped her/his earlier wait', async (w, person: string) => {
  await waitsForMatch(w, person, { range: 5 });
  await w.harness.apply(stopWaiting, { person });
});
When(
  '{actor} widens the range of her/his earlier wait to {int} points',
  async (w, person: string, range: number) =>
    w.harness.apply(changeRange, {
      person,
      range,
      participantId: w.firstWaits.get(person)!,
    })
);
When(
  '{actor} changes her/his range to a growing range',
  async (w, person: string) =>
    w.harness.apply(changeRange, { person, range: -1 })
);

Then(
  '{actor} accepts nobody more than {int} points away',
  async (w, person: string, points: number) =>
    expect(await w.harness.read(deviceRange, { person })).toBe(points)
);
Then(
  '{actor} accepts anyone within {int} points',
  async (w, person: string, points: number) =>
    expect(await w.harness.read(deviceRange, { person })).toBe(points)
);
Then(
  '{actor} cannot be matched with someone {int} points away',
  async (w, person: string, points: number) =>
    expect(await w.harness.read(deviceRange, { person })).toBeLessThan(points)
);
Then('{actor} is told that earlier change already counted', async (w) => {
  expect(
    ((await w.harness.read(lastUpdate)) as { updated: boolean })?.updated
  ).toBe(true);
});
