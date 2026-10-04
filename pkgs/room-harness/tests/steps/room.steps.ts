/**
 * Steps every part of the game room shares: who is in the room, going
 * offline and coming back online, an app closing unexpectedly, time
 * passing, and who the room shows present. Each `{actor}` names a person
 * and their phone.
 */

import { expect } from 'bun:test';
import type { Run } from '@pkgs/harness-shared/run-types';
import { addClient, connect, crash, disconnect, restart } from '@pkgs/room-harness/room-actions';
import { clientState, connected, inSync } from '@pkgs/room-harness/observations';
import { exampleSystem } from '@pkgs/room-harness/system';
import { expectHashMatch, readRejection } from '@pkgs/room-harness/read-state';
import { expectInSync } from '@pkgs/room-harness/expect-in-sync';
import type { RoomHarness } from '@pkgs/room-harness/harness';
import { Given, room, Then, When } from './world';
import type { RoomWorld } from './world';

export const SECOND_MS = 1_000;

/** Open the example game room with `people` in it, each on their phone. */
export async function openRoom(
  w: RoomWorld,
  people: readonly string[]
): Promise<Run<RoomHarness>> {
  const s = await exampleSystem.run({ seed: w.ctx.testId });
  w.harness = s;
  for (const id of people) {
    await s.apply(addClient, { id, identity: id });
  }
  await expectInSync(s);
  return s;
}

/** The ids of every phone in the room. */
export async function everyone(
  s: Run<RoomHarness>
): Promise<readonly string[]> {
  return Object.keys(await s.read(clientState));
}

/**
 * Wait (on virtual time, acting on nothing) until every phone is back in
 * the room and agrees with it.
 */
export async function settleEveryone(s: Run<RoomHarness>): Promise<void> {
  await s.until(allConnectedAndInSync, { stepMs: 25, maxMs: 15_000 });
  for (const id of await everyone(s)) {
    await expectHashMatch(s, id);
  }
}

async function allConnectedAndInSync(harness: RoomHarness): Promise<boolean> {
  const ids = connected(harness);
  return ids.length === harness.kit.clients.size && (await inSync(harness));
}

/** Assert `id` was told `reason` for their last refused command. */
export async function expectToldThat(
  s: Run<RoomHarness>,
  id: string,
  reason: string
): Promise<void> {
  expect((await readRejection(s, id))?.reason).toBe(reason);
}

function roster(harness: RoomHarness): readonly string[] {
  return harness.kit.server.getRoster().map((entry) => entry.id);
}

Given(
  '{actor} and {actor} are in the room',
  async (w, a: string, b: string) => {
    await openRoom(w, [a, b]);
  }
);

Given(
  '{actor}, {actor} and {actor} are in the room',
  async (w, a: string, b: string, c: string) => {
    await openRoom(w, [a, b, c]);
  }
);

async function goOffline(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(disconnect, id);
}

Given("{actor}'s phone is offline", goOffline);
When("{actor}'s phone goes offline", goOffline);

When("{actor}'s phone comes back online", async (w, id: string) => {
  await room(w).apply(connect, id);
});

Given(
  "{actor}'s phone has been offline for {int} seconds",
  async (w, id: string, seconds: number) => {
    await room(w).apply(disconnect, id);
    await room(w).advanceTime(seconds * SECOND_MS);
  }
);

Given("{actor}'s app has closed unexpectedly", async (w, id: string) => {
  await room(w).apply(crash, id);
});

When('{actor} reopens the app', async (w, id: string) => {
  await room(w).apply(restart, id);
});

async function secondsPass(w: RoomWorld, seconds: number): Promise<void> {
  await room(w).advanceTime(seconds * SECOND_MS);
}

Given('{int} seconds have passed', secondsPass);
When('{int} seconds pass', secondsPass);

Then(
  'the room shows {actor} and {actor} present',
  async (w, a: string, b: string) => {
    expect([...(await room(w).read(roster))].sort()).toEqual([a, b].sort());
  }
);

Then('the room shows only {actor} present', async (w, id: string) => {
  expect(await room(w).read(roster)).toEqual([id]);
});
