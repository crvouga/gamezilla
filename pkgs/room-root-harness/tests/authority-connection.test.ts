import { expect, test } from 'bun:test';
import { gameRoomModule, readTally } from '@pkgs/room-root-harness/game-room';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared/wire';
import {
  addOneCommand,
  connectPerson,
  framesOfKind,
  startServer,
} from './server-rig';

// regression: space-guest-command-after-host-offline
test('dependent connections wait for authority without writing or receiving history', async () => {
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      connectionView: (grants) =>
        grants.includes('lead')
          ? { mode: 'authority' }
          : { mode: 'dependent', reason: 'room authority is offline' },
    },
  });
  connectPerson(rig, 'alice', ['lead']);
  const guest = connectPerson(rig, 'bob');
  await rig.server.handleClientMessage('bob', 'bob', addOneCommand('first'));
  expect(readTally(rig.server.getCommittedState())).toBe(1);
  rig.server.unregisterConnection('alice');
  await rig.server.handleClientMessage('bob', 'bob', addOneCommand('blocked'));
  expect(readTally(rig.server.getCommittedState())).toBe(1);
  expect(framesOfKind(guest.frames, ROOM_WIRE_KIND.rejected)).toEqual([
    {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.rejected,
      commandId: 'blocked',
      error: {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'room authority is offline',
      },
    },
  ]);
  const late = connectPerson(rig, 'carol');
  await rig.server.handleClientMessage('carol', 'carol', {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.sync,
    fromSeq: 0,
  });
  expect(framesOfKind(late.frames, ROOM_WIRE_KIND.welcome)).toEqual([]);
  expect(rig.server.getRoster()).toEqual([]);
  connectPerson(rig, 'alice', ['lead']);
  await rig.server.handleClientMessage(
    'alice',
    'alice',
    addOneCommand('return')
  );
  expect(framesOfKind(late.frames, ROOM_WIRE_KIND.welcome)).toHaveLength(1);
  await rig.server.handleClientMessage('bob', 'bob', addOneCommand('resumed'));
  expect(readTally(rig.server.getCommittedState())).toBe(3);
});

// regression: space-guest-command-after-host-offline
test('authority leaving during authorization refuses the waiting command', async () => {
  let stopHost = () => {};
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      connectionView: (grants) =>
        grants.includes('lead')
          ? { mode: 'authority' }
          : { mode: 'dependent', reason: 'room authority is offline' },
    },
    authorize: async () => {
      stopHost();
      return { ok: true };
    },
  });
  connectPerson(rig, 'alice', ['lead']);
  const guest = connectPerson(rig, 'bob');
  stopHost = () => rig.server.unregisterConnection('alice');
  await rig.server.handleClientMessage(
    'bob',
    'bob',
    addOneCommand('during-auth')
  );
  expect(readTally(rig.server.getCommittedState())).toBe(0);
  expect(framesOfKind(guest.frames, ROOM_WIRE_KIND.rejected)).toHaveLength(1);
});
