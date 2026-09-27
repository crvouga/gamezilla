import { describe, expect, test } from 'bun:test';
import type { Message } from '@pkgs/message';
import {
  type LogEntry,
  MAX_PENDING_OUTBOUND_COMMANDS,
  ROOM_ERROR_TYPE,
  ROOM_WIRE_KIND,
  RoomClient,
  RoomMetaAttr,
  type RoomState,
  WIRE_VERSION,
} from '@pkgs/room';
import {
  CursorModule,
  Move,
  Moved,
  readMoves,
  readPositions,
} from './helpers/cursor-module';
import { FakeTransport } from './helpers/fake-transport';
import { CountingClientStorage } from './helpers/memory-storage';
import { testPorts } from './helpers/ports';

type Opened = {
  room: RoomClient<RoomState, Message, Message, string>;
  transport: FakeTransport;
  storage: CountingClientStorage;
  handles: () => number;
  errors: unknown[];
};

const ACTOR = { id: 'alice', clientId: 'tab' };

function welcome(entries: LogEntry[], lastSeq = entries.at(-1)?.seq ?? 0) {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.welcome,
    fromSeq: 0,
    lastSeq,
    entries,
  };
}

function committed(entries: LogEntry[], commandId?: string) {
  return commandId === undefined
    ? { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.committed, entries }
    : { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.committed, commandId, entries };
}

function movedEntry(seq: number, id: string, x: number): LogEntry {
  return { seq, event: Moved({ id, x, y: 0 }), actor: ACTOR, ts: 1 };
}

async function open(storage = new CountingClientStorage()): Promise<Opened> {
  const ports = testPorts();
  const transport = new FakeTransport();
  const errors: unknown[] = [];
  let handles = 0;
  const module = {
    ...CursorModule,
    handle: (...args: Parameters<typeof CursorModule.handle>) => {
      handles += 1;
      return CursorModule.handle(...args);
    },
  };
  const room = await RoomClient.open<RoomState, Message, Message, string>({
    topic: 't',
    module,
    storage,
    transport,
    identity: 'alice',
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
    onError: (e) => {
      errors.push(e);
    },
  });
  return { room, transport, storage, handles: () => handles, errors };
}

/** Pull the command frames the client sent, oldest first. */
function sentCommands(transport: FakeTransport): { id: string }[] {
  return transport.sent.filter(
    (f) => (f as { kind: string }).kind === ROOM_WIRE_KIND.command
  ) as { id: string }[];
}

describe('RoomClient engine', () => {
  test('open sends sync; welcome marks synced and flushes the offline queue', async () => {
    const o = await open();
    expect(o.transport.sent[0]).toEqual({
      v: WIRE_VERSION,
      kind: 'sync',
      fromSeq: 0,
    });
    o.room.dispatch(Move({ x: 1, y: 2 }));
    expect(readPositions(o.room.getSnapshot())['alice']).toEqual({
      x: 1,
      y: 2,
    });
    expect(RoomMetaAttr.isSynced.from(o.room.getSnapshot())).toBe(false);
    expect(sentCommands(o.transport)).toHaveLength(0);

    o.transport.deliver(welcome([]));
    expect(RoomMetaAttr.isSynced.from(o.room.getSnapshot())).toBe(true);
    expect(sentCommands(o.transport)).toHaveLength(1);
    await o.room.flushIo();
    expect(o.storage.queue.map((q) => q.id)).toEqual([
      ...o.room.getPendingQueueIds(),
    ]);
    o.room.destroy();
  });

  test('own-command echo skips the rebase; foreign commits rebase pending commands', async () => {
    const o = await open();
    o.transport.deliver(welcome([]));
    o.room.dispatch(Move({ x: 1, y: 0 }));
    o.room.dispatch(Move({ x: 2, y: 0 }));
    o.room.dispatch(Move({ x: 3, y: 0 }));
    const [c1, c2] = sentCommands(o.transport);
    const before = o.handles();
    const snapBefore = o.room.getSnapshot();

    // Server commits exactly what we predicted for the head → no re-handle.
    o.transport.deliver(committed([movedEntry(1, 'alice', 1)], c1!.id));
    expect(o.handles()).toBe(before);
    expect(o.room.getSnapshot()).toBe(snapBefore);
    expect(o.room.getPendingQueueIds()).toHaveLength(2);
    expect(o.room.getLastSeq()).toBe(1);

    // A foreign event lands: the two pending commands are re-handled (rebase).
    o.transport.deliver(committed([movedEntry(2, 'bob', 9)]));
    expect(o.handles()).toBe(before + 2);
    const snap = o.room.getSnapshot();
    expect(readPositions(snap)['bob']).toEqual({ x: 9, y: 0 });
    expect(readPositions(snap)['alice']).toEqual({ x: 3, y: 0 });
    expect(readMoves(snap)).toBe(4);

    // Echo with events that differ from our prediction → falls back to rebase.
    o.transport.deliver(committed([movedEntry(3, 'alice', 7)], c2!.id));
    expect(o.handles()).toBe(before + 3);
    expect(readPositions(o.room.getSnapshot())['alice']).toEqual({
      x: 3,
      y: 0,
    });
    o.room.destroy();
  });

  test('snapshot identity is stable across roster frames and changes on state', async () => {
    const o = await open();
    o.transport.deliver(welcome([]));
    const a = o.room.getSnapshot();
    o.transport.deliver({ v: WIRE_VERSION, kind: 'roster', clients: [ACTOR] });
    expect(o.room.getSnapshot()).toBe(a);
    expect(o.room.getRoster()).toEqual([ACTOR]);
    o.transport.deliver(committed([movedEntry(1, 'bob', 1)]));
    expect(o.room.getSnapshot()).not.toBe(a);
    o.room.destroy();
  });

  test('getLog returns a fresh array only after the log changed', async () => {
    const o = await open();
    o.transport.deliver(welcome([movedEntry(1, 'bob', 1)]));
    const log1 = o.room.getLog();
    expect(log1).toHaveLength(1);
    expect(o.room.getLog()).toBe(log1);
    o.transport.deliver(committed([movedEntry(2, 'bob', 2)]));
    const log2 = o.room.getLog();
    expect(log2).not.toBe(log1);
    expect(log2.map((e) => e.seq)).toEqual([1, 2]);
    expect(log1).toHaveLength(1);
    o.room.destroy();
  });

  test('persistence is append-only and coalesced; ack before flush leaves no ghost row', async () => {
    const o = await open();
    o.transport.deliver(
      welcome([movedEntry(1, 'bob', 1), movedEntry(2, 'bob', 2)])
    );
    o.room.dispatch(Move({ x: 1, y: 1 }));
    const [c1] = sentCommands(o.transport);
    o.transport.deliver(committed([movedEntry(3, 'alice', 1)], c1!.id));
    o.transport.deliver(committed([movedEntry(4, 'bob', 3)]));
    await o.room.flushIo();
    expect(o.storage.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(o.storage.appendedEntries).toBe(4);
    expect(o.storage.resets).toBe(0);
    expect(o.storage.queue).toEqual([]);
    expect(o.room.getPendingQueueIds()).toEqual([]);
    o.room.destroy();
  });

  test('rejected command is dropped, error surfaced, display recomputed', async () => {
    const o = await open();
    o.transport.deliver(welcome([]));
    o.room.dispatch(Move({ x: 5, y: 5 }));
    const [c1] = sentCommands(o.transport);
    o.transport.deliver({
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId: c1!.id,
      error: { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' },
    });
    expect(readPositions(o.room.getSnapshot())['alice']).toBeUndefined();
    expect(o.errors).toEqual([
      { type: ROOM_ERROR_TYPE.conflict, reason: 'nope' },
    ]);
    expect(RoomMetaAttr.lastError.from(o.room.getSnapshot())).toEqual({
      type: ROOM_ERROR_TYPE.conflict,
      reason: 'nope',
    });
    o.room.destroy();
  });

  test('stale welcome / gap resets the local tail and re-syncs', async () => {
    const o = await open();
    o.transport.deliver(
      welcome([movedEntry(1, 'bob', 1), movedEntry(2, 'bob', 2)])
    );
    expect(o.room.getLastSeq()).toBe(2);
    // Server is behind us (reset) → wipe + sync from 0.
    o.transport.deliver(welcome([], 1));
    expect(o.room.getLastSeq()).toBe(0);
    expect(o.transport.sent.at(-1)).toEqual({
      v: WIRE_VERSION,
      kind: 'sync',
      fromSeq: 0,
    });
    await o.room.flushIo();
    expect(o.storage.resets).toBe(1);
    expect(o.storage.entries).toEqual([]);
    // Gap in committed stream → unsynced + sync from tip.
    o.transport.deliver(welcome([movedEntry(1, 'bob', 1)]));
    o.transport.deliver(committed([movedEntry(3, 'bob', 3)]));
    expect(RoomMetaAttr.isSynced.from(o.room.getSnapshot())).toBe(false);
    expect(o.transport.sent.at(-1)).toEqual({
      v: WIRE_VERSION,
      kind: 'sync',
      fromSeq: 1,
    });
    o.room.destroy();
  });

  test('hydrates from local cache and rebases the durable queue; corrupt cache is wiped', async () => {
    const storage = new CountingClientStorage();
    storage.entries = [movedEntry(1, 'bob', 1)];
    storage.queue = [{ id: 'q1', ts: 1, payload: Move({ x: 4, y: 4 }) }];
    const o = await open(storage);
    expect(o.room.getLastSeq()).toBe(1);
    expect(readPositions(o.room.getSnapshot())).toEqual({
      bob: { x: 1, y: 0 },
      alice: { x: 4, y: 4 },
    });
    expect(o.room.getPendingQueueIds()).toEqual(['q1']);
    o.room.destroy();

    const corrupt = new CountingClientStorage();
    corrupt.entries = [movedEntry(5, 'bob', 1)];
    const c = await open(corrupt);
    expect(c.room.getLastSeq()).toBe(0);
    expect(corrupt.resets).toBe(1);
    c.room.destroy();
  });

  test('bounded outbound queue reports rate-limited', async () => {
    const o = await open();
    for (let i = 0; i < MAX_PENDING_OUTBOUND_COMMANDS; i++) {
      o.room.dispatch(Move({ x: i, y: 0 }));
    }
    o.room.dispatch(Move({ x: 1, y: 1 }));
    expect(o.errors.at(-1)).toEqual({ type: ROOM_ERROR_TYPE.rateLimited });
    expect(o.room.getPendingQueueIds()).toHaveLength(
      MAX_PENDING_OUTBOUND_COMMANDS
    );
    o.room.destroy();
  });

  test('untilSynced resolves on welcome and times out via injected timers', async () => {
    const ports = testPorts();
    const transport = new FakeTransport();
    const room = await RoomClient.open<RoomState, Message, Message, string>({
      topic: 't',
      module: CursorModule,
      storage: new CountingClientStorage(),
      transport,
      identity: 'alice',
      clock: ports.clock,
      timers: ports.timers,
      createId: ports.createId,
    });
    const timeout = room.untilSynced(10);
    ports.fire();
    await expect(timeout).rejects.toThrow('timeout');
    const ok = room.untilSynced(10);
    transport.deliver(welcome([]));
    await ok;
    room.destroy();
  });
});
