import { expect, test } from 'bun:test';
import { createOfflineNetworkController } from '@libs/app-root-client/offline-network-controller';
import { createOfflineRoomTransport } from '@libs/app-root-client/offline-network-realtime';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import type { ClientTransportHandlers } from '@pkgs/room-root-shared/transport';

// regression: offline-room-failed-connect-strands-host
test('a room whose first connection fails keeps the adapter that will reconnect it', async () => {
  const controller = createOfflineNetworkController(new KvImplInMemory());
  await controller.ready();
  let handlers: ClientTransportHandlers | null = null;
  let destroys = 0;
  let opens = 0;
  const room = createOfflineRoomTransport(controller, () => ({
    isConnected: false,
    connect: () => Promise.reject(new Error('server unreachable')),
    sendJson: () => undefined,
    subscribe: () => () => undefined,
    onHandlers: (next) => {
      handlers = next;
      return () => undefined;
    },
    destroy: () => {
      destroys += 1;
    },
  }));
  room.onHandlers({
    onOpen: () => {
      opens += 1;
    },
  });

  await expect(room.connect()).rejects.toThrow('server unreachable');
  expect(destroys).toBe(0);

  // The adapter's own retry gets through once the connection is back.
  (handlers as ClientTransportHandlers | null)?.onOpen?.();
  expect(opens).toBe(1);
});
