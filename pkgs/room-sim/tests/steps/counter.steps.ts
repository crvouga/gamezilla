/**
 * Steps for the shared counter room (`counterSystem`) and the ownership room
 * (`authzApp`) set to turn one person away.
 */

import { expect } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import {
  authzApp,
  authzOwner,
  bootRoomSim,
  Claim,
  counterSystem,
  counterValue,
  disconnect,
  dispatch,
  Increment,
  ROOM_ARGS,
  ROOM_DRAW,
  ROOM_VIRTUAL_RUNTIME,
  type RoomApp,
  type RoomArgs,
  type RoomSim,
  readClient,
  readServer,
} from '@pkgs/room-sim';
import { defineSystem } from '@pkgs/sim';
import { everyone, join, settleEveryone } from './room.steps';
import { Given, type RoomWorld, room, Then, When } from './world';

function turningAway(id: string) {
  const app: RoomApp = {
    ...authzApp,
    authorize: async (identity) =>
      identity === id ? { ok: false, reason: 'turned away' } : { ok: true },
  };
  return defineSystem<RoomSim, RoomArgs>({
    name: `room.authz-turns-away-${id}`,
    args: ROOM_ARGS,
    sample: ROOM_DRAW,
    create: (session, args) => bootRoomSim(session, app, args),
    runtimes: [ROOM_VIRTUAL_RUNTIME],
  });
}

async function openCounter(w: RoomWorld, people: readonly string[]) {
  w.sim = await counterSystem.run({ seed: w.ctx.testId });
  await join(w, people);
}

async function increment(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(dispatch, { clientId: id, payload: Increment({}) });
}

Given('{actor} is in a shared counter room', async (w, id: string) => {
  await openCounter(w, [id]);
});

Given(
  '{actor} and {actor} are in a shared counter room',
  async (w, a: string, b: string) => {
    await openCounter(w, [a, b]);
  }
);

Given(
  '{actor} and {actor} are in an ownership room that turns {actor} away',
  async (w, a: string, b: string, away: string) => {
    w.sim = await turningAway(away).run({ seed: w.ctx.testId });
    await join(w, [a, b]);
  }
);

When('{actor} increments the count', increment);

Given('{actor} has incremented the count', async (w, id: string) => {
  await increment(w, id);
  await room(w).advanceTime(0);
});

Given(
  '{actor} has incremented the count {int} times',
  async (w, id: string, times: number) => {
    for (let i = 0; i < times; i += 1) await increment(w, id);
    await room(w).advanceTime(0);
    expect(counterValue(await readServer(room(w)))).toBe(times);
  }
);

Given(
  '{actor} has incremented the count while offline',
  async (w, id: string) => {
    await room(w).apply(disconnect, id);
    await increment(w, id);
  }
);

When(
  '{actor} makes a change the room does not understand',
  async (w, id: string) => {
    await room(w).apply(dispatch, {
      clientId: id,
      payload: { type: asKeyword('space-counter-cmd/nope'), payload: {} },
    });
  }
);

Given('nobody has claimed the room', async (w) => {
  expect(authzOwner(await readServer(room(w)))).toBeNull();
});

When('{actor} claims the room', async (w, id: string) => {
  await room(w).apply(dispatch, { clientId: id, payload: Claim({}) });
});

Then("the room's count is {int}", async (w, n: number) => {
  expect(counterValue(await readServer(room(w)))).toBe(n);
});

Then(
  "{actor}'s device shows a count of {int}",
  async (w, id: string, n: number) => {
    expect(counterValue(await readClient(room(w), id))).toBe(n);
  }
);

Then('everyone agrees on a count of {int}', async (w, n: number) => {
  const s = room(w);
  await settleEveryone(s);
  expect(counterValue(await readServer(s))).toBe(n);
  for (const id of await everyone(s)) {
    expect(counterValue(await readClient(s, id))).toBe(n);
  }
});
