import { expect, test } from 'bun:test';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import { defineRoomModule } from '@pkgs/room-root-shared-ts/module';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { connectPerson, framesOfKind, startServer } from './server-rig';

const tally = {
  name: 'game-room',
  initialState: gameRoomModule.initialState,
  handle: gameRoomModule.handle,
  reduce: gameRoomModule.reduce,
};

test('the shared definition supplies canonical hashing and needs no runtime for turns', async () => {
  const module = defineRoomModule(tally);
  const rig = await startServer({ module });
  try {
    await rig.server.injectCommand({
      id: 'turn',
      payload: AddOne({}),
      identity: 'alice',
    });
    const state = rig.server.getCommittedState();
    expect(readTally(state)).toBe(1);
    expect(module.hash(state)).toBe(gameRoomModule.hash(state));
    expect(module.recoverEffects(state)).toEqual([]);
    expect(module.createRuntime).toBeUndefined();
    expect(() => defineRoomModule({ ...tally, name: 'bad/name' })).toThrow();
  } finally {
    rig.server.dispose();
  }
});

test('runtime inputs commit through the same rules and preserve custom recovery and hashing', async () => {
  const updates: number[] = [];
  const errors: unknown[] = [];
  const module = defineRoomModule({
    ...gameRoomModule,
    createRuntime: (ports) => ({
      receive: (command) => {
        void ports
          .commit(command.id, command.payload)
          .catch(errors.push.bind(errors));
        return null;
      },
      update: (state) => updates.push(readTally(state)),
    }),
  });
  const rig = await startServer({ module });
  try {
    connectPerson(rig, 'alice');
    await rig.server.handleClientMessage('alice', 'alice', {
      v: WIRE_VERSION,
      kind: 'signal',
      id: 'runtime-command',
      ts: 0,
      payload: AddOne({}),
    });
    expect(readTally(await rig.server.readCommittedState())).toBe(1);
    expect(updates).toEqual([0, 1]);
    expect(rig.storage.entries).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(module.recoverEffects).toBe(gameRoomModule.recoverEffects);
    expect(module.hash).toBe(gameRoomModule.hash);
  } finally {
    rig.server.dispose();
  }
});

test('the host owns runtime replacement and disposes each instance once', async () => {
  const lifecycle: string[] = [];
  let generation = 0;
  const rig = await startServer({
    module: defineRoomModule({
      ...gameRoomModule,
      createRuntime: () => {
        const id = ++generation;
        return {
          update: (state) => lifecycle.push(`${id}:state:${readTally(state)}`),
          dispose: () => lifecycle.push(`${id}:dispose`),
        };
      },
    }),
  });
  const alice = connectPerson(rig, 'alice');
  try {
    await rig.server.handleClientMessage('alice', 'alice', {
      v: WIRE_VERSION,
      kind: 'signal',
      id: 'unsupported',
      ts: 0,
      payload: AddOne({}),
    });
    expect(framesOfKind(alice.frames, 'rejected')[0]).toMatchObject({
      error: { type: ROOM_ERROR_TYPE.invalidCommand },
    });
    await rig.server.hydrateFromStorage();
  } finally {
    rig.server.dispose();
    rig.server.dispose();
  }
  expect(lifecycle).toEqual([
    '1:state:0',
    '1:dispose',
    '2:state:0',
    '2:dispose',
  ]);
});
