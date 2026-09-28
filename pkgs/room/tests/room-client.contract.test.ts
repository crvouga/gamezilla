/**
 * Contract: `RoomClient` over a fake transport the test plays the room
 * through — the sync handshake, replay of pending commands on the committed
 * log, snapshot and log identity, device storage batches, and re-sync on an
 * untrustworthy log. The room behavior people see (changes show at once,
 * wait offline, survive an app restart, refusals) is stated in
 * `specs/room/`; this file pins the frames, rows and identities under it.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import {
  MAX_PENDING_OUTBOUND_COMMANDS,
  ROOM_ERROR_TYPE,
  RoomMetaAttr,
  WIRE_VERSION,
} from '@pkgs/room';
import {
  ACTOR,
  type ClientRig,
  commandId,
  committed,
  movedEntry,
  nextSeq,
  openClient,
  sentCommands,
  type Vec,
  welcome,
} from './helpers/client-rig';
import { Move, readMoves, readPositions } from './helpers/cursor-module';
import { CountingClientStorage } from './helpers/memory-storage';

const open: ClientRig[] = [];

afterEach(() => {
  for (const rig of open.splice(0)) rig.room.destroy();
});

async function openRoom(storage?: CountingClientStorage): Promise<ClientRig> {
  const rig = await openClient(storage);
  open.push(rig);
  return rig;
}

function move(rig: ClientRig, at: Vec): void {
  rig.moves.push(at);
  rig.room.dispatch(Move({ x: at.x, y: at.y }));
}

function moveAlongX(rig: ClientRig, xs: readonly number[]): void {
  for (const x of xs) move(rig, { x, y: 0 });
}

/** A client that has taken a welcome holding bob's moves along x. */
async function syncedWith(bobXs: readonly number[] = []): Promise<ClientRig> {
  const rig = await openRoom();
  rig.transport.deliver(
    welcome(bobXs.map((x, i) => movedEntry(i + 1, 'bob', { x, y: 0 })))
  );
  return rig;
}

function commitPredicted(rig: ClientRig, n: number): void {
  const at = rig.moves[n - 1];
  if (at === undefined) throw new Error(`alice made no move ${n}`);
  rig.transport.deliver(
    committed([movedEntry(nextSeq(rig), 'alice', at)], commandId(rig, n))
  );
}

function commitOther(rig: ClientRig, person: string, at: Vec): void {
  rig.transport.deliver(committed([movedEntry(nextSeq(rig), person, at)]));
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

describe('room client: syncs before it sends', () => {
  test('opening a room asks to sync from sequence number 0', async () => {
    const rig = await openRoom();
    expect(lastSyncRequest(rig)).toEqual(syncFrom(0));
  });

  test('a move before the welcome shows at once but is not sent', async () => {
    const rig = await openRoom();
    move(rig, { x: 1, y: 2 });
    expect(readPositions(rig.room.getSnapshot())['alice']).toEqual({
      x: 1,
      y: 2,
    });
    expect(isSynced(rig)).toBe(false);
    expect(sentCommands(rig)).toHaveLength(0);
  });

  test('the welcome syncs the room, sends what waited, and stores the queue', async () => {
    const rig = await openRoom();
    move(rig, { x: 1, y: 2 });
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
    moveAlongX(rig, [1, 2, 3]);
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
    moveAlongX(rig, [1, 2, 3]);
    commitPredicted(rig, 1);
    const handles = rig.handles();
    commitOther(rig, 'bob', { x: 9, y: 0 });
    expect(rig.handles() - handles).toBe(2);
    const snapshot = rig.room.getSnapshot();
    expect(readPositions(snapshot)['bob']).toEqual({ x: 9, y: 0 });
    expect(readPositions(snapshot)['alice']).toEqual({ x: 3, y: 0 });
    expect(readMoves(snapshot)).toBe(4);
  });

  test('a commit that differs from the prediction replays the pending commands', async () => {
    const rig = await syncedWith();
    moveAlongX(rig, [1, 2, 3]);
    commitPredicted(rig, 1);
    commitOther(rig, 'bob', { x: 9, y: 0 });
    const handles = rig.handles();
    rig.transport.deliver(
      committed(
        [movedEntry(nextSeq(rig), 'alice', { x: 7, y: 0 })],
        commandId(rig, 2)
      )
    );
    expect(rig.handles() - handles).toBe(1);
    expect(readPositions(rig.room.getSnapshot())['alice']).toEqual({
      x: 3,
      y: 0,
    });
  });

  test('a rejected command is dropped and its error reported and shown', async () => {
    const rig = await syncedWith();
    move(rig, { x: 5, y: 5 });
    rig.transport.deliver({
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId: commandId(rig, 1),
      error: { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' },
    });
    const conflict = { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' };
    expect(readPositions(rig.room.getSnapshot())['alice']).toBeUndefined();
    expect(rig.errors).toEqual([conflict]);
    expect(RoomMetaAttr.lastError.from(rig.room.getSnapshot())).toEqual(
      conflict
    );
  });

  test('the outbound queue is bounded and reports rate-limited past it', async () => {
    const rig = await openRoom();
    for (let i = 0; i <= MAX_PENDING_OUTBOUND_COMMANDS; i += 1) {
      move(rig, { x: i, y: 0 });
    }
    expect(rig.errors.at(-1)).toEqual({ type: ROOM_ERROR_TYPE.rateLimited });
    expect(rig.room.getPendingQueueIds()).toHaveLength(
      MAX_PENDING_OUTBOUND_COMMANDS
    );
  });
});

describe('room client: snapshots and logs change identity only when they change', () => {
  test('a roster leaves the snapshot object as it was', async () => {
    const rig = await syncedWith();
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
    commitOther(rig, 'bob', { x: 1, y: 0 });
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
    commitOther(rig, 'bob', { x: 2, y: 0 });
    const log = rig.room.getLog();
    expect(log).not.toBe(earlier);
    expect(log.map((e) => e.seq)).toEqual([1, 2]);
    expect(earlier).toHaveLength(1);
  });
});

describe('room client: device storage', () => {
  test('storage only appends, in batches, and keeps no acknowledged command', async () => {
    const rig = await syncedWith([1, 2]);
    move(rig, { x: 1, y: 1 });
    commitPredicted(rig, 1);
    commitOther(rig, 'bob', { x: 3, y: 0 });
    await rig.room.flushIo();
    expect(rig.storage.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(rig.storage.appendedEntries).toBe(4);
    expect(rig.storage.resets).toBe(0);
    expect(rig.storage.queue).toEqual([]);
    expect(rig.room.getPendingQueueIds()).toHaveLength(0);
  });

  test('a room reopens from the stored log and queue', async () => {
    const storage = new CountingClientStorage();
    storage.entries = [movedEntry(1, 'bob', { x: 1, y: 0 })];
    storage.queue = [{ id: 'q1', ts: 1, payload: Move({ x: 4, y: 4 }) }];
    const rig = await openRoom(storage);
    const positions = readPositions(rig.room.getSnapshot());
    expect(rig.room.getLastSeq()).toBe(1);
    expect(positions['bob']).toEqual({ x: 1, y: 0 });
    expect(positions['alice']).toEqual({ x: 4, y: 4 });
    expect([...rig.room.getPendingQueueIds()]).toEqual(['q1']);
  });

  test('a stored log with a gap is wiped on open', async () => {
    const storage = new CountingClientStorage();
    storage.entries = [movedEntry(5, 'bob', { x: 1, y: 0 })];
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
    rig.transport.deliver(committed([movedEntry(3, 'bob', { x: 3, y: 0 })]));
    expect(isSynced(rig)).toBe(false);
    expect(lastSyncRequest(rig)).toEqual(syncFrom(1));
  });
});
