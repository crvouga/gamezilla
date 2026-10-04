/**
 * Steps for the game room's shared tally: adding one, taking one off, and
 * the tally each person's app shows.
 */

import { expect } from 'bun:test';
import {
  holdRoomChanges,
  pendingRoomChangeIds,
  stopAsRoomChangeCounts,
} from '@pkgs/room-harness/commit-recovery';
import { AddOne, readTally, TakeOne } from '@pkgs/room-harness/game-room';
import type { RoomHarness } from '@pkgs/room-harness/harness';
import { readClient, readServer } from '@pkgs/room-harness/read-state';
import {
  disconnect,
  dispatch,
  resumeNetwork,
  serverRestart,
} from '@pkgs/room-harness/room-actions';
import { everyone, SECOND_MS, settleEveryone } from './room.steps';
import type { RoomWorld } from './world';
import { Given, room, Then, When } from './world';

/** How long "sees a tally" watches a person's app for a change. */
const STILL_FOR_MS = 5 * SECOND_MS;

async function addOne(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(dispatch, { clientId: id, payload: AddOne({}) });
}

function tallyShownTo(id: string) {
  return (harness: RoomHarness): number | null => {
    const device = harness.kit.clients.get(id);
    if (device === undefined || device.isCrashed()) return null;
    return readTally(device.snapshot());
  };
}

When('{actor} adds one to the tally', addOne);

When('{actor} takes one off the tally', async (w, id: string) => {
  await room(w).apply(dispatch, { clientId: id, payload: TakeOne({}) });
});

Given('{actor} has added one to the tally', async (w, id: string) => {
  await addOne(w, id);
  await settleEveryone(room(w));
});

Given(
  '{actor} has added one to the tally {int} times',
  async (w, id: string, times: number) => {
    for (let i = 0; i < times; i += 1) await addOne(w, id);
    await settleEveryone(room(w));
    expect(readTally(await readServer(room(w)))).toBe(times);
  }
);

Given(
  '{actor} has added one to the tally while offline',
  async (w, id: string) => {
    await room(w).apply(disconnect, id);
    await addOne(w, id);
  }
);

Given(
  '{actor} has added one while the room became unavailable',
  async (w, id: string) => {
    const s = room(w);
    await s.apply(holdRoomChanges, await everyone(s));
    await addOne(w, id);
    const commandId = (await s.read(pendingRoomChangeIds, id)).at(-1);
    if (commandId === undefined) throw new Error('Chosen change was not kept');
    await s.apply(stopAsRoomChangeCounts, {
      person: id,
      id: commandId,
      payload: AddOne({}),
    });
  }
);

async function availableAgain(w: RoomWorld): Promise<void> {
  const s = room(w);
  await s.apply(serverRestart);
  for (const id of await everyone(s)) await s.apply(resumeNetwork, id);
  await settleEveryone(s);
}

When('the room is available again', availableAgain);

// The person's app shows `n` now and keeps showing it for a while.
Then(
  '{actor} (still )sees a tally of {int}',
  async (w, id: string, n: number) => {
    await room(w).never(tallyShownTo(id), {
      forMs: STILL_FOR_MS,
      pred: (shown) => shown !== n,
    });
  }
);

Then('everyone (still )sees a tally of {int}', async (w, n: number) => {
  const s = room(w);
  await settleEveryone(s);
  expect(readTally(await readServer(s))).toBe(n);
  for (const id of await everyone(s)) {
    expect(readTally(await readClient(s, id))).toBe(n);
  }
});
