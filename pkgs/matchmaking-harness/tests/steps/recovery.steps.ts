import { expect } from 'bun:test';
import type { CurrentSearch } from '@pkgs/matchmaking-shared/identity';
import type { JoinResult } from '@pkgs/matchmaking-shared/types';
import { availability, connectDevice, lastBegin, lastOffline, repeatBegin, stopWaiting } from '@pkgs/matchmaking-harness/lobby';
import { deviceConnected, deviceView } from '@pkgs/matchmaking-harness/devices';
import { leave, tick, updateFormulas } from '@pkgs/matchmaking-harness/actions';
import { participantIds, privateStatus } from '@pkgs/matchmaking-harness/observations';
import { ratingWithin } from '@pkgs/matchmaking-harness/attrs';
import { waitsForMatch } from './matchmaking.steps';
import { Given, Then, When } from './world';
import type { MatchmakingWorld } from './world';

async function offline(w: MatchmakingWorld, person: string): Promise<void> {
  w.awayViews.set(person, await w.harness.read(deviceView, { person }));
  await w.harness.apply(connectDevice, { person, connected: false });
}

Given("{actor}'s phone is offline", offline);
When("{actor}'s phone goes offline", offline);
When("{actor}'s phone comes back online", async (w, person: string) =>
  w.harness.apply(connectDevice, { person, connected: true })
);
When('{actor} opens matchmaking on another device', async (w, person: string) =>
  w.harness.apply(connectDevice, { person, place: 'computer', connected: true })
);
When(
  '{actor} waits for a match with a rating of {int} on another device',
  async (w, person: string, rating: number) =>
    waitsForMatch(w, person, { rating, place: 'computer' })
);
Given('{actor} is waiting again on another device', async (w, person: string) =>
  waitsForMatch(w, person, { place: 'computer' })
);
When('{actor} stops waiting on another device', async (w, person: string) =>
  w.harness.apply(stopWaiting, { person, place: 'computer' })
);
When('{actor} stops her/his earlier wait', async (w, person: string) =>
  w.harness.apply(stopWaiting, {
    person,
    participantId: w.firstWaits.get(person)!,
  })
);
When(
  '{actor} repeats her/his earlier request for a match',
  async (w, person: string) => w.harness.apply(repeatBegin, { person })
);
When(
  "{actor} tries to stop {actor}'s wait",
  async (w, person: string, owner: string) =>
    w.harness.apply(leave, { ownerId: person, ref: owner })
);
When(
  "{actor} tries to widen {actor}'s range to {int} points",
  async (w, person: string, owner: string, points: number) =>
    w.harness.apply(updateFormulas, {
      ownerId: person,
      ref: owner,
      formulas: [ratingWithin(points)],
    })
);
When(
  "{actor} asks to see {actor}'s wait",
  async (w, person: string, owner: string) => {
    const id = (await w.harness.read(participantIds))[owner]!;
    w.privateStatus = await w.harness.read(privateStatus, person, id);
  }
);

Then(
  "{actor}'s other device shows the same wait",
  async (w, person: string) => {
    const view = await w.harness.read(deviceView, {
      person,
      place: 'computer',
    });
    expect(view?.participantId).toBe(w.firstWaits.get(person));
  }
);
Then('{actor} has the same wait', async (w, person: string) => {
  const view = await w.harness.read(deviceView, { person });
  expect(view?.participantId).toBe(w.firstWaits.get(person));
  expect(view?.result?.status).toBe('waiting');
});
Then(
  "{actor}'s phone shows her/his last known wait",
  async (w, person: string) => {
    const current = await w.harness.read(deviceView, { person });
    const known = w.awayViews.get(person) as CurrentSearch | null;
    expect(current?.participantId).toBe(known?.participantId);
    expect(current?.result).toEqual(known?.result);
  }
);
Then(
  "{actor}'s phone shows her/his last known range",
  async (w, person: string) =>
    expect(await w.harness.read(deviceView, { person })).toEqual(
      w.awayViews.get(person) as CurrentSearch | null
    )
);
Then('{actor} is told matchmaking needs a connection', async (w) =>
  expect(await w.harness.read(lastOffline)).toBe(true)
);
Then('{actor} can wait for a match', async (w, person: string) =>
  expect(await w.harness.read(deviceConnected, { person })).toBe(true)
);
Then(
  '{actor} is told her/his earlier wait has ended',
  async (w, person: string) => {
    const id = w.firstWaits.get(person)!;
    expect((await w.harness.read(privateStatus, person, id))?.status).not.toBe(
      'waiting'
    );
  }
);
Then('{actor} is told no wait is available to her/him', (w) => {
  expect(w.privateStatus).toBeNull();
});

Given(
  "{actor}'s phone was offline when she/he was matched with {actor}",
  async (w, person: string, other: string) => {
    await waitsForMatch(w, person, { rating: 1000, range: 200 });
    await waitsForMatch(w, other, { rating: 1050, range: 200 });
    await offline(w, person);
    await w.harness.apply(tick, {});
  }
);
Given(
  "{actor}'s phone was offline when she/he stopped waiting on another device",
  async (w, person: string) => {
    await waitsForMatch(w, person);
    await offline(w, person);
    await w.harness.apply(stopWaiting, { person, place: 'computer' });
  }
);
Given(
  '{actor} asked for a match while her/his phone was offline',
  async (w, person: string) => {
    await offline(w, person);
    await waitsForMatch(w, person);
  }
);
Given(
  '{actor} asked to stop waiting while her/his phone was offline',
  async (w, person: string) => {
    await waitsForMatch(w, person);
    await offline(w, person);
    await w.harness.apply(stopWaiting, { person });
  }
);

When('{actor} becomes unavailable for a match', async (w, person: string) =>
  w.harness.apply(availability, { person, available: false })
);
When('{actor} becomes available for a match again', async (w, person: string) =>
  w.harness.apply(availability, { person, available: true })
);
Given('{actor} is available for a match( again)', async (w, person: string) =>
  w.harness.apply(availability, { person, available: true })
);
Given('{actor} is unavailable for a match', async (w, person: string) =>
  w.harness.apply(availability, { person, available: false })
);
Given(
  '{actor} was waiting but is unavailable for a match',
  async (w, person: string) => {
    await waitsForMatch(w, person);
    await w.harness.apply(availability, { person, available: false });
  }
);
Given(
  "{actor}'s earlier wait ended when she/he became unavailable",
  async (w, person: string) => {
    await waitsForMatch(w, person);
    await w.harness.apply(availability, { person, available: false });
  }
);
Then('{actor} is told she/he is unavailable for a match', async (w) =>
  expect(((await w.harness.read(lastBegin)) as JoinResult)?.outcome).toBe(
    'unavailable'
  )
);
