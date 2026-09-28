/**
 * Steps every room kind shares: devices going offline and coming back,
 * stalled networks, time passing, crashes, and what the room confirms.
 * Each `{actor}` names a person and their device.
 */

import { expect } from 'bun:test';
import type { Run } from '@pkgs/harness';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  armCrashAt,
  clientState,
  connect,
  connected,
  crash,
  disconnect,
  expectHashMatch,
  expectInSync,
  inSync,
  logSeq,
  pauseNetwork,
  type RoomHarness,
  readClientHash,
  readRejection,
  restart,
  resumeNetwork,
  serverCrash,
  serverCrashed,
  serverRestart,
} from '@pkgs/room-harness';
import { Given, type RoomWorld, recall, room, Then, When } from './world';

/** Add `people` to an open room, let it settle, and note what each sees. */
export async function join(
  w: RoomWorld,
  people: readonly string[]
): Promise<void> {
  const s = room(w);
  for (const id of people) {
    await s.apply(addClient, { id, identity: id });
  }
  await expectInSync(s);
  for (const id of people) {
    w.memo.set(`view:${id}`, await readClientHash(s, id));
  }
}

/** The ids of every device in the room. */
export async function everyone(
  s: Run<RoomHarness>
): Promise<readonly string[]> {
  return Object.keys(await s.read(clientState));
}

/**
 * Wait (on virtual time, acting on nothing) until every device is back in
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

function pendingIds(id: string) {
  return (harness: RoomHarness): readonly string[] =>
    harness.kit.clients.get(id)?.room()?.getPendingQueueIds() ?? [];
}

function roster(harness: RoomHarness): readonly string[] {
  return harness.kit.server.getRoster().map((entry) => entry.id);
}

async function offline(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(disconnect, id);
}

Given("{actor}'s device is offline", offline);
When("{actor}'s device goes offline", offline);

async function reconnect(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(connect, id);
}

When('{actor} reconnects', reconnect);

async function stall(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(pauseNetwork, id);
}

Given("{actor}'s network has stalled", stall);

async function recover(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(resumeNetwork, id);
}

When("{actor}'s network recovers", recover);

When('{int} ms pass', async (w, ms: number) => {
  await room(w).advanceTime(ms);
});

Given("{actor}'s app has crashed", async (w, id: string) => {
  await room(w).apply(crash, id);
});

When("{actor}'s app restarts", async (w, id: string) => {
  await room(w).apply(restart, id);
});

Given(
  "{actor}'s app will crash right after the room confirms her next change",
  async (w, id: string) => {
    await room(w).apply(armCrashAt, {
      clientId: id,
      event: 'afterNextCommitted' as const,
    });
  }
);

When('the room crashes', async (w) => {
  await room(w).apply(serverCrash);
});

Given('the room has crashed', async (w) => {
  await room(w).apply(serverCrash);
});

When('the room restarts', async (w) => {
  await room(w).apply(serverRestart);
});

Then('the room is down', async (w) => {
  expect(await room(w).read(serverCrashed)).toBe(true);
});

Then('the room is up', async (w) => {
  expect(await room(w).read(serverCrashed)).toBe(false);
});

Then(
  'the room shows {actor} and {actor} present',
  async (w, a: string, b: string) => {
    expect([...(await room(w).read(roster))].sort()).toEqual([a, b].sort());
  }
);

Then('the room shows only {actor} present', async (w, id: string) => {
  expect(await room(w).read(roster)).toEqual([id]);
});

Then('the room has accepted {int} change(s)', async (w, count: number) => {
  expect(await room(w).read(logSeq)).toBe(count);
});

Then("{actor}'s change is refused as invalid", async (w, id: string) => {
  expect((await readRejection(room(w), id))?.type).toBe(
    ROOM_ERROR_TYPE.invalidCommand
  );
});

Then("{actor}'s change is refused as not allowed", async (w, id: string) => {
  expect((await readRejection(room(w), id))?.type).toBe(
    ROOM_ERROR_TYPE.unauthorized
  );
});

Then('{actor} has no changes waiting to be sent', async (w, id: string) => {
  expect(await room(w).read(pendingIds(id))).toEqual([]);
});

Then("nothing on {actor}'s device has changed", async (w, id: string) => {
  expect(await readClientHash(room(w), id)).toBe(
    recall<string>(w, `view:${id}`)
  );
});
