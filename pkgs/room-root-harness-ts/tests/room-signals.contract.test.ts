import { expect, test } from 'bun:test';
import type { Message } from '@pkgs/message-shared-ts/message';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { openClient, welcome } from './client-rig';
import { connectPerson, framesOfKind, startServer } from './server-rig';

const signalFrame = (id = 'point-1') => ({
  v: WIRE_VERSION,
  kind: 'signal',
  id,
  ts: -100,
  payload: AddOne({}),
});

test('a live execution that schedules work still requires the injected timer port', async () => {
  await expect(
    startServer({
      module: {
        ...gameRoomModule,
        createRuntime: (ports) => ({
          update: () => {
            ports.timers.setTimeout(() => {}, 1);
          },
        }),
      },
    })
  ).rejects.toThrow('room runtime requires injected timers');
});

// regression: room-signal-replaced-connection
test('a queued signal from a removed connection cannot run as its replacement', async () => {
  let calls = 0;
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      createRuntime: () => ({
        receive: () => {
          calls++;
          return null;
        },
      }),
    },
  });
  connectPerson(rig, 'alice');
  const queued = rig.server.handleClientMessage(
    'alice',
    'alice',
    signalFrame('point-1')
  );
  rig.server.unregisterConnection('alice');
  connectPerson(rig, 'alice');
  await queued;
  expect(calls).toBe(0);
  expect(rig.storage.entries).toEqual([]);
});

test('signals reuse room authorization and never write the event log or command verdict store', async () => {
  const received: unknown[] = [];
  const authorized: unknown[] = [];
  const rig = await startServer({
    authorize: async (identity, topic, command, grants) => {
      authorized.push({ identity, topic, command, grants });
      return { ok: true };
    },
    module: {
      ...gameRoomModule,
      createRuntime: () => ({
        receive: (command, identity, actor) => {
          received.push({ command, identity, actor });
          return null;
        },
      }),
    },
  });
  connectPerson(rig, 'alice', ['control-token']);
  await rig.server.handleClientMessage('alice', 'alice', signalFrame());
  expect(received).toHaveLength(1);
  expect(received[0]).toMatchObject({
    identity: 'alice',
    actor: { id: 'alice', clientId: 'alice' },
    command: { payload: AddOne({}), ts: 1000 },
  });
  expect(authorized[0]).toMatchObject({
    identity: 'alice',
    topic: 'room:1',
    grants: ['control-token'],
  });
  expect(rig.storage.entries).toEqual([]);
  expect(rig.storage.dedup.size).toBe(0);
  expect(readTally(rig.server.getCommittedState())).toBe(0);
});

test('denied, expired and unregistered connections cannot deliver transient controls', async () => {
  let calls = 0;
  const rig = await startServer({
    authorize: async (identity) =>
      identity === 'bob'
        ? { ok: false, reason: 'watching only' }
        : { ok: true },
    module: {
      ...gameRoomModule,
      createRuntime: () => ({
        receive: () => {
          calls++;
          return null;
        },
      }),
    },
  });
  const bob = connectPerson(rig, 'bob');
  const alice = connectPerson(rig, 'alice', ['session-until:0']);
  await rig.server.handleClientMessage('bob', 'bob', signalFrame());
  await rig.server.handleClientMessage('alice', 'alice', signalFrame());
  await rig.server.handleClientMessage('absent', 'absent', signalFrame());
  expect(calls).toBe(0);
  expect(framesOfKind(bob.frames, 'rejected')).toEqual([
    {
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId: 'point-1',
      error: { type: ROOM_ERROR_TYPE.unauthorized, reason: 'watching only' },
    },
  ]);
  expect(framesOfKind(alice.frames, 'rejected')).toHaveLength(1);
  expect(rig.storage.dedup.size).toBe(0);
});

test('a signal handler owns value validation and refuses without a durable rejection row', async () => {
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      createRuntime: () => ({
        receive: () => ({
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: 'unknown input',
        }),
      }),
    },
  });
  const alice = connectPerson(rig, 'alice');
  await rig.server.handleClientMessage('alice', 'alice', signalFrame());
  expect(framesOfKind(alice.frames, 'rejected')).toHaveLength(1);
  expect(rig.storage.dedup.size).toBe(0);
});

test('snapshots fan out once on room transport with audience and session lifetime filtering', async () => {
  const rig = await startServer();
  const alice = connectPerson(rig, 'alice');
  const bob = connectPerson(rig, 'bob');
  const expired = connectPerson(rig, 'eve', ['session-until:0']);
  rig.server.publishSignal(AddOne({}));
  const first = framesOfKind(alice.frames, 'signal')[0];
  expect(first).toEqual({
    v: WIRE_VERSION,
    kind: 'signal',
    payload: AddOne({}),
  });
  expect(framesOfKind(bob.frames, 'signal')[0]).toBe(first);
  expect(framesOfKind(expired.frames, 'signal')).toEqual([]);
  rig.server.publishSignal(AddOne({}), ['alice']);
  expect(framesOfKind(alice.frames, 'signal')).toHaveLength(2);
  expect(framesOfKind(bob.frames, 'signal')).toHaveLength(1);
  expect(rig.storage.entries).toEqual([]);
});

test('offline controls are refused, never queued, and never replayed after reconnect', async () => {
  const rig = await openClient();
  try {
    expect(rig.room.sendSignal(AddOne({}))).toBeNull();
    rig.transport.deliver(welcome([]));
    expect(rig.room.sendSignal(AddOne({}))).toStartWith('signal:');
    expect(rig.room.getPendingQueueIds()).toEqual([]);
    expect(rig.room.getLog()).toEqual([]);
    expect(rig.handles()).toBe(0);
    expect(rig.storage.queueSaves).toBe(0);
    rig.transport.close();
    expect(rig.room.sendSignal(AddOne({}))).toBeNull();
    rig.transport.connect();
    expect(rig.room.sendSignal(AddOne({}))).toBeNull();
    rig.transport.deliver(welcome([]));
    expect(framesOfKind(rig.transport.sent, 'signal')).toHaveLength(1);
  } finally {
    rig.room.destroy();
  }
});

test('transient subscriptions receive synced frames and release listeners on teardown', async () => {
  const rig = await openClient();
  const signals: Message[] = [];
  rig.room.subscribeSignal((payload) => signals.push(payload));
  const frame = { v: WIRE_VERSION, kind: 'signal', payload: AddOne({}) };
  rig.transport.deliver(frame);
  expect(signals).toEqual([]);
  rig.transport.deliver(welcome([]));
  rig.transport.deliver(frame);
  expect(signals).toEqual([AddOne({})]);
  expect(rig.room.getLog()).toEqual([]);
  expect(readTally(rig.room.getSnapshot())).toBe(0);
  rig.room.destroy();
  rig.transport.deliver(frame);
  expect(signals).toHaveLength(1);
  expect(rig.room.sendSignal(AddOne({}))).toBeNull();
});
