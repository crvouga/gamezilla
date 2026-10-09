/**
 * Contract: `RoomClient` over a fake transport the test plays the room
 * through — the sync handshake, replay of pending commands on the committed
 * log, snapshot and log identity, device storage batches, and re-sync on an
 * untrustworthy log. The room behavior people see (changes show at once,
 * wait offline, survive an app restart, refusals) is stated in
 * `specs/room/`; this file pins the frames, rows and identities under it.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { AddOne, readTally } from '@pkgs/room-root-harness/game-room';
import { MAX_PENDING_OUTBOUND_COMMANDS } from '@pkgs/room-root-shared/bounds';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { WIRE_VERSION } from '@pkgs/room-root-shared/wire';
import type { ClientRig } from './client-rig';
import {
  ACTOR,
  change,
  commandId,
  committed,
  nextSeq,
  openClient,
  sentCommands,
  tallyEntry,
  welcome,
} from './client-rig';
import { CountingClientStorage } from './memory-storage';

const open: ClientRig[] = [];

afterEach(() => {
  for (const rig of open.splice(0)) rig.room.destroy();
});

async function openRoom(storage?: CountingClientStorage): Promise<ClientRig> {
  const rig = await openClient(storage);
  open.push(rig);
  return rig;
}

function addOnes(rig: ClientRig, times: number): void {
  for (let i = 0; i < times; i += 1) change(rig, 1);
}

function tally(rig: ClientRig): number {
  return readTally(rig.room.getSnapshot());
}

/** A client that has taken a welcome holding bob's changes to the tally. */
async function syncedWith(
  bobChanges: readonly number[] = []
): Promise<ClientRig> {
  const rig = await openRoom();
  rig.transport.deliver(
    welcome(bobChanges.map((by, i) => tallyEntry(i + 1, 'bob', by)))
  );
  return rig;
}

/** The room commits alice's `n`th change as she predicted it. */
function commitPredicted(rig: ClientRig, n: number): void {
  const by = rig.changes[n - 1];
  if (by === undefined) throw new Error(`alice made no change ${n}`);
  rig.transport.deliver(
    committed([tallyEntry(nextSeq(rig), 'alice', by)], commandId(rig, n))
  );
}

function commitOther(rig: ClientRig, person: string, by: number): void {
  rig.transport.deliver(committed([tallyEntry(nextSeq(rig), person, by)]));
}

function isSynced(rig: ClientRig): boolean {
  return RoomMetaAttr.isSynced.from(rig.room.getSnapshot());
}

function lastSyncRequest(rig: ClientRig): unknown {
  return rig.transport.sent.at(-1);
}

function syncFrom(fromSeq: number) {
  return { v: WIRE_VERSION, kind: 'sync', fromSeq };
}

function settled(wait: Promise<unknown>): Promise<unknown> {
  return wait.then(
    () => 'ok',
    (error: unknown) => error
  );
}

// regression: room-notify-reactive-resubscribe
test('replacing a subscription during notification waits for the next room change', async () => {
  const rig = await openRoom();
  let notifications = 0;
  let unsubscribe: (() => void) | undefined;
  const listener = () => {
    notifications += 1;
    // A finite remount sequence also bounds the broken live-Set iteration.
    if (notifications < 3) {
      unsubscribe?.();
      unsubscribe = rig.room.subscribe(listener);
    }
  };
  unsubscribe = rig.room.subscribe(listener);
  rig.transport.deliver(welcome([]));
  expect(notifications).toBe(1);
  rig.transport.deliver(committed([tallyEntry(1, 'bob', 1)]));
  expect(notifications).toBe(2);
  unsubscribe();
  rig.transport.deliver(committed([tallyEntry(2, 'bob', 1)]));
  expect(notifications).toBe(2);
});

test('a listener removed during notification does not receive that room change', async () => {
  const rig = await openRoom();
  let notifications = 0;
  let unsubscribe: (() => void) | undefined;
  rig.room.subscribe(() => unsubscribe?.());
  unsubscribe = rig.room.subscribe(() => {
    notifications += 1;
  });
  rig.transport.deliver(welcome([]));
  expect(notifications).toBe(0);
});

describe('room client: syncs before it sends', () => {
  test('opening a room asks to sync from sequence number 0', async () => {
    const rig = await openRoom();
    expect(lastSyncRequest(rig)).toEqual(syncFrom(0));
  });

  test('a change before the welcome shows at once but is not sent', async () => {
    const rig = await openRoom();
    change(rig, 1);
    expect(tally(rig)).toBe(1);
    expect(isSynced(rig)).toBe(false);
    expect(sentCommands(rig)).toHaveLength(0);
  });

  test('the welcome syncs the room, sends what waited, and stores the queue', async () => {
    const rig = await openRoom();
    change(rig, 1);
    rig.transport.deliver(welcome([]));
    await rig.room.flushIo();
    expect(isSynced(rig)).toBe(true);
    expect(sentCommands(rig)).toHaveLength(1);
    expect(rig.storage.queue.map((q) => q.id)).toEqual([
      ...rig.room.getPendingQueueIds(),
    ]);
  });

  test('untilSynced fails with a timeout when its timer fires', async () => {
    const rig = await openRoom();
    const wait = settled(rig.room.untilSynced(10));
    rig.fireTimers();
    const outcome = await wait;
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toContain('timeout');
  });

  test('untilSynced resolves when the welcome arrives', async () => {
    const rig = await openRoom();
    const wait = settled(rig.room.untilSynced(10));
    rig.transport.deliver(welcome([]));
    expect(await wait).toBe('ok');
  });
});

describe('room client: pending commands replay on the committed log', () => {
  test('a commit matching the prediction replays nothing and keeps the snapshot', async () => {
    const rig = await syncedWith();
    addOnes(rig, 3);
    const handles = rig.handles();
    const snapshot = rig.room.getSnapshot();
    commitPredicted(rig, 1);
    expect(rig.handles() - handles).toBe(0);
    expect(rig.room.getSnapshot()).toBe(snapshot);
    expect(rig.room.getPendingQueueIds()).toHaveLength(2);
    expect(rig.room.getLastSeq()).toBe(1);
  });

  test("someone else's commit replays the pending commands on top", async () => {
    const rig = await syncedWith();
    addOnes(rig, 3);
    commitPredicted(rig, 1);
    const handles = rig.handles();
    commitOther(rig, 'bob', 9);
    expect(rig.handles() - handles).toBe(2);
    expect(tally(rig)).toBe(12);
  });

  test('a commit that differs from the prediction replays the pending commands', async () => {
    const rig = await syncedWith();
    addOnes(rig, 3);
    commitPredicted(rig, 1);
    commitOther(rig, 'bob', 9);
    const handles = rig.handles();
    rig.transport.deliver(
      committed([tallyEntry(nextSeq(rig), 'alice', -1)], commandId(rig, 2))
    );
    expect(rig.handles() - handles).toBe(1);
    expect(tally(rig)).toBe(10);
  });

  test('a rejected command is dropped and its error reported and shown', async () => {
    const rig = await syncedWith();
    change(rig, 1);
    rig.transport.deliver({
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId: commandId(rig, 1),
      error: { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' },
    });
    const conflict = { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' };
    expect(tally(rig)).toBe(0);
    expect(rig.errors).toEqual([conflict]);
    expect(RoomMetaAttr.lastError.from(rig.room.getSnapshot())).toEqual(
      conflict
    );
  });

  test('the outbound queue is bounded and reports rate-limited past it', async () => {
    const rig = await openRoom();
    addOnes(rig, MAX_PENDING_OUTBOUND_COMMANDS + 1);
    expect(rig.errors.at(-1)).toEqual({ type: ROOM_ERROR_TYPE.rateLimited });
    expect(rig.room.getPendingQueueIds()).toHaveLength(
      MAX_PENDING_OUTBOUND_COMMANDS
    );
  });
});

describe('room client: snapshots and logs change identity only when they change', () => {
  test('subsequent rosters leave the snapshot object as it was', async () => {
    const rig = await syncedWith();
    rig.transport.deliver({ v: WIRE_VERSION, kind: 'roster', clients: [] });
    const snapshot = rig.room.getSnapshot();
    rig.transport.deliver({
      v: WIRE_VERSION,
      kind: 'roster',
      clients: [ACTOR],
    });
    expect(rig.room.getSnapshot()).toBe(snapshot);
    expect(rig.room.getRoster()).toEqual([ACTOR]);
  });

  test('a commit gives a new snapshot object', async () => {
    const rig = await syncedWith();
    const snapshot = rig.room.getSnapshot();
    commitOther(rig, 'bob', 1);
    expect(rig.room.getSnapshot()).not.toBe(snapshot);
  });

  test('reading an unchanged log twice gives the same array', async () => {
    const rig = await syncedWith([1]);
    const log = rig.room.getLog();
    expect(log).toHaveLength(1);
    expect(rig.room.getLog()).toBe(log);
  });

  test('a commit gives a new log array and leaves the old one alone', async () => {
    const rig = await syncedWith([1]);
    const earlier = rig.room.getLog();
    commitOther(rig, 'bob', 2);
    const log = rig.room.getLog();
    expect(log).not.toBe(earlier);
    expect(log.map((e) => e.seq)).toEqual([1, 2]);
    expect(earlier).toHaveLength(1);
  });
});

describe('room client: device storage', () => {
  test('storage only appends, in batches, and keeps no acknowledged command', async () => {
    const rig = await syncedWith([1, 2]);
    change(rig, 1);
    commitPredicted(rig, 1);
    commitOther(rig, 'bob', 3);
    await rig.room.flushIo();
    expect(rig.storage.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(rig.storage.appendedEntries).toBe(4);
    expect(rig.storage.resets).toBe(0);
    expect(rig.storage.queue).toEqual([]);
    expect(rig.room.getPendingQueueIds()).toHaveLength(0);
  });

  test('a room reopens from the stored log and queue', async () => {
    const storage = new CountingClientStorage();
    storage.entries = [tallyEntry(1, 'bob', 5)];
    storage.queue = [{ id: 'q1', ts: 1, payload: AddOne({}) }];
    const rig = await openRoom(storage);
    expect(rig.room.getLastSeq()).toBe(1);
    expect(tally(rig)).toBe(6);
    expect([...rig.room.getPendingQueueIds()]).toEqual(['q1']);
  });

  test('a stored log with a gap is wiped on open', async () => {
    const storage = new CountingClientStorage();
    storage.entries = [tallyEntry(5, 'bob', 1)];
    const rig = await openRoom(storage);
    expect(rig.room.getLastSeq()).toBe(0);
    expect(storage.resets).toBe(1);
  });
});

describe('room client: re-syncs when its log cannot be trusted', () => {
  test('a welcome behind the local log wipes it and re-syncs from 0', async () => {
    const rig = await syncedWith([1, 2]);
    rig.transport.deliver(welcome([], 1));
    await rig.room.flushIo();
    expect(rig.room.getLastSeq()).toBe(0);
    expect(lastSyncRequest(rig)).toEqual(syncFrom(0));
    expect(rig.storage.resets).toBe(1);
    expect(rig.storage.entries).toEqual([]);
  });

  test('a gap in the committed stream re-syncs from the local tip', async () => {
    const rig = await syncedWith([1]);
    rig.transport.deliver(committed([tallyEntry(3, 'bob', 3)]));
    expect(isSynced(rig)).toBe(false);
    expect(lastSyncRequest(rig)).toEqual(syncFrom(1));
  });
});
