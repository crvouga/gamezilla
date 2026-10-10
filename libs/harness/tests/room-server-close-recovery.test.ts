import { expect, test } from 'bun:test';
import {
  partitionAwareRoomTransport,
  ROOM_HEARTBEAT_MS,
} from '@libs/harness/partition-aware-room-transport';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { ClientTransportHandlers } from '@pkgs/room-root-shared/transport';

// regression: space-link-preview-orphaned-after-leave
test('a server close reconnects and a stale close cannot drop its replacement', async () => {
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  const closeSockets: (() => void)[] = [];
  const destroyed: number[] = [];
  const events: string[] = [];
  const transport = partitionAwareRoomTransport({
    timers,
    reachable: () => true,
    open: () => {
      const id = closeSockets.length;
      let connected = false;
      let handlers: ClientTransportHandlers = {};
      closeSockets.push(() => {
        connected = false;
        handlers.onClose?.();
      });
      return {
        get isConnected() {
          return connected;
        },
        connect: () => {
          connected = true;
          handlers.onOpen?.();
        },
        sendJson: () => {},
        subscribe: () => () => {},
        onHandlers: (next) => {
          handlers = next;
          return () => {};
        },
        destroy: () => {
          connected = false;
          destroyed.push(id);
        },
      };
    },
  });
  transport.onHandlers({
    onOpen: () => events.push('open'),
    onClose: () => events.push('close'),
  });
  try {
    await transport.connect();
    closeSockets[0]!();
    expect(transport.isConnected).toBe(false);
    expect(destroyed).toEqual([0]);
    clock.advance(ROOM_HEARTBEAT_MS);
    await Promise.resolve();
    expect(transport.isConnected).toBe(true);
    expect(closeSockets).toHaveLength(2);
    closeSockets[0]!();
    expect(transport.isConnected).toBe(true);
    expect(events).toEqual(['open', 'close', 'open']);
  } finally {
    transport.destroy();
  }
  expect(destroyed).toEqual([0, 1]);
  expect(clock.nextDueAt()).toBeNull();
});
