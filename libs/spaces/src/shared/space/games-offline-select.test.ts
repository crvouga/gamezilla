import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { assertRoomModuleName, RoomClient, RoomMetaAttr } from '@pkgs/room';
import { InMemoryClientStorage } from '@pkgs/room/client/adapters/storage/memory';

import type { GameDefinition } from './game';
import { GamesRoomAttr, SelectGame } from './games';
import { createSpaceModule } from './space-module';
import { SPACE_ROOM_MODULE_NAME } from './space-room-module-name';

/** Never-connected transport — Connecting… / offline. */
class DisconnectedTransport {
  get isConnected(): boolean {
    return false;
  }

  connect(): void {}

  sendJson(_payload: unknown): void {}

  subscribe(_handler: (raw: unknown) => void): () => void {
    return () => {};
  }

  onHandlers(_h: {
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (err: Error) => void;
  }): () => void {
    return () => {};
  }

  destroy(): void {}
}

const chessStub: GameDefinition = {
  id: 'chess',
  commandRouters: [],
  eventRouters: [],
};

describe('SelectGame offline-first', () => {
  it('updates GamesRoomAttr.selected while the transport is disconnected', async () => {
    const module = createSpaceModule(
      assertRoomModuleName(SPACE_ROOM_MODULE_NAME),
      [chessStub],
      wallClock.now
    );
    const transport = new DisconnectedTransport();
    const room = await RoomClient.open({
      topic: 'space:test-offline-select',
      module,
      storage: new InMemoryClientStorage(),
      transport,
      identity: 'host-1',
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
    });

    expect(RoomMetaAttr.isConnected.from(room.getSnapshot())).toBe(false);
    expect(GamesRoomAttr.selected.from(room.getSnapshot())).toBe(null);

    room.dispatch(SelectGame({ game: 'chess' }));
    expect(GamesRoomAttr.selected.from(room.getSnapshot())).toBe('chess');

    room.dispatch(SelectGame({ game: null }));
    expect(GamesRoomAttr.selected.from(room.getSnapshot())).toBe(null);

    room.destroy();
    transport.destroy();
  });
});
