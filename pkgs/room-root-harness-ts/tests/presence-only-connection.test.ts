import { expect, test } from 'bun:test';
import {
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import {
  addOneCommand,
  connectPerson,
  framesOfKind,
  startServer,
} from './server-rig';

// regression: space-preview-discloses-game-history
test('a presence connection sees availability without history or write access', async () => {
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      connectionView: (grants) =>
        grants.includes('participate')
          ? { mode: 'full' }
          : { mode: 'presence', reason: 'room participation required' },
    },
  });
  connectPerson(rig, 'alice', ['participate']);
  await rig.server.handleClientMessage(
    'alice',
    'alice',
    addOneCommand('first')
  );
  const preview = connectPerson(rig, 'bob');
  await rig.server.handleClientMessage('bob', 'bob', {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.sync,
    fromSeq: 0,
  });
  expect(framesOfKind(preview.frames, ROOM_WIRE_KIND.welcome)).toEqual([
    {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      lastSeq: 0,
      entries: [],
    },
  ]);
  expect(rig.server.getRoster()).toEqual([{ id: 'alice', clientId: 'alice' }]);
  await rig.server.handleClientMessage('alice', 'alice', addOneCommand('next'));
  expect(framesOfKind(preview.frames, ROOM_WIRE_KIND.committed)).toEqual([]);
  await rig.server.handleClientMessage(
    'bob',
    'bob',
    addOneCommand('preview-write')
  );
  expect(readTally(rig.server.getCommittedState())).toBe(2);
  expect(framesOfKind(preview.frames, ROOM_WIRE_KIND.rejected)).toHaveLength(1);
});
