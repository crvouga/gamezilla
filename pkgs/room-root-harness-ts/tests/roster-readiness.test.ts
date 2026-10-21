import { expect, test } from 'bun:test';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { FakeTransport } from './fake-transport';
import { CountingClientStorage } from './memory-storage';
import { testPorts } from './ports';

test('roster readiness accepts an empty answer and resets for each connection', async () => {
  const transport = new FakeTransport();
  const ports = testPorts();
  const room = await RoomClient.open({
    topic: 'roster-readiness',
    module: gameRoomModule,
    storage: new CountingClientStorage(),
    transport,
    identity: 'alice',
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
  });
  try {
    expect(RoomMetaAttr.isConnected.from(room.getSnapshot())).toBe(true);
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(false);
    transport.deliver({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      lastSeq: 0,
      entries: [],
    });
    expect(RoomMetaAttr.isSynced.from(room.getSnapshot())).toBe(true);
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(false);
    transport.close();
    transport.connect();
    transport.deliver({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: [],
    });
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(true);
    expect(RoomMetaAttr.isSynced.from(room.getSnapshot())).toBe(false);
    expect(room.getRoster()).toEqual([]);
    transport.close();
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(false);
    transport.connect();
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(false);
    transport.deliver({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: [{ id: 'bob', clientId: 'bob-phone' }],
    });
    expect(RoomMetaAttr.hasRoster.from(room.getSnapshot())).toBe(true);
    expect(room.getRoster()).toEqual([{ id: 'bob', clientId: 'bob-phone' }]);
  } finally {
    room.destroy();
    transport.destroy();
  }
});
