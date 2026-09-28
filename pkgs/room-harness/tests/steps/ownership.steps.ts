/**
 * Steps for owning the game room: claiming it, turning someone away, and
 * what each person is told when the room refuses them.
 */

import { expect } from 'bun:test';
import {
  ClaimRoom,
  REFUSAL,
  readOwner,
  readTurnedAway,
  TurnAway,
} from '@pkgs/room/harness';
import { dispatch, readClient, readServer } from '@pkgs/room-harness';
import { everyone, expectToldThat, settleEveryone } from './room.steps';
import { Given, type RoomWorld, room, Then, When } from './world';

async function claim(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(dispatch, { clientId: id, payload: ClaimRoom({}) });
}

async function turnAway(
  w: RoomWorld,
  id: string,
  person: string
): Promise<void> {
  await room(w).apply(dispatch, {
    clientId: id,
    payload: TurnAway({ person }),
  });
}

Given('nobody owns the room', async (w) => {
  expect(readOwner(await readServer(room(w)))).toBeNull();
});

Given('{actor} owns the room', async (w, id: string) => {
  await claim(w, id);
  await settleEveryone(room(w));
  expect(readOwner(await readServer(room(w)))).toBe(id);
});

Given(
  '{actor} has turned {actor} away',
  async (w, id: string, person: string) => {
    await claim(w, id);
    await turnAway(w, id, person);
    await settleEveryone(room(w));
    expect(readTurnedAway(await readServer(room(w)))).toContain(person);
  }
);

When('{actor} claims the room', claim);

When('{actor} turns {actor} away', turnAway);

Then(
  'everyone (still )sees that {actor} owns the room',
  async (w, id: string) => {
    const s = room(w);
    await settleEveryone(s);
    expect(readOwner(await readServer(s))).toBe(id);
    for (const person of await everyone(s)) {
      expect(readOwner(await readClient(s, person))).toBe(id);
    }
  }
);

Then('everyone sees that {actor} is turned away', async (w, id: string) => {
  const s = room(w);
  await settleEveryone(s);
  expect(readTurnedAway(await readServer(s))).toContain(id);
  for (const person of await everyone(s)) {
    expect(readTurnedAway(await readClient(s, person))).toContain(id);
  }
});

Then('{actor} is told the room already has an owner', async (w, id: string) => {
  await expectToldThat(room(w), id, REFUSAL.alreadyOwned);
});

Then(
  '{actor} is told only the owner can turn someone away',
  async (w, id: string) => {
    await expectToldThat(room(w), id, REFUSAL.onlyTheOwner);
  }
);

Then(
  '{actor} is told the owner cannot turn themselves away',
  async (w, id: string) => {
    await expectToldThat(room(w), id, REFUSAL.ownerStays);
  }
);

Then('{actor} is told they have been turned away', async (w, id: string) => {
  await expectToldThat(room(w), id, REFUSAL.turnedAway);
});
