import { expect, test } from 'bun:test';
import { LoopbackRoomTransport } from '@pkgs/room-adapter-memory-shared-ts/loopback-transport';

// regression: space-link-preview-orphaned-after-leave
test('a server close notifies the client and permits a fresh registration', async () => {
  const connections = new Set<string>();
  const transport = new LoopbackRoomTransport({
    connectionId: 'bob-link-preview',
    identity: 'bob',
    clientId: 'bob-device',
    server: {
      registerConnection: (id) => connections.add(id),
      unregisterConnection: (id) => connections.delete(id),
      handleClientMessage: async () => {},
    },
  });
  const events: string[] = [];
  transport.onHandlers({
    onOpen: () => events.push('open'),
    onClose: () => events.push('close'),
  });
  await transport.connect();
  transport.closeFromServer();
  transport.closeFromServer();
  expect(transport.isConnected).toBe(false);
  expect(connections.size).toBe(0);
  expect(events).toEqual(['open', 'close']);
  await transport.connect();
  expect(connections).toEqual(new Set(['bob-link-preview']));
  expect(transport.isConnected).toBe(true);
  expect(events).toEqual(['open', 'close', 'open']);
  transport.destroy();
  expect(connections.size).toBe(0);
});
