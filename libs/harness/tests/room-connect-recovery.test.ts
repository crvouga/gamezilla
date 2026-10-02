import { expect, test } from 'bun:test';
import {
  partitionAwareRoomTransport,
  ROOM_HEARTBEAT_MS,
} from '@libs/harness/fabric/partition-aware-room-transport';
import { createHarnessClock } from '@pkgs/clock';

// regression: harness-room-first-open-never-recovers
test('a first admission refusal retries on the next heartbeat', async () => {
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  let attempts = 0;
  let destroyed = 0;
  const transport = partitionAwareRoomTransport({
    timers,
    reachable: () => true,
    open: () => {
      let connected = false;
      return {
        get isConnected() {
          return connected;
        },
        connect: async () => {
          attempts++;
          if (attempts === 1) throw new Error('membership not yet received');
          connected = true;
        },
        sendJson: () => {},
        subscribe: () => () => {},
        onHandlers: () => () => {},
        destroy: () => {
          connected = false;
          destroyed++;
        },
      };
    },
  });
  try {
    await expect(transport.connect()).rejects.toThrow(
      'membership not yet received'
    );
    clock.advance(ROOM_HEARTBEAT_MS);
    await Promise.resolve();
    expect(attempts).toBe(2);
    expect(transport.isConnected).toBe(true);
    expect(destroyed).toBe(1);
  } finally {
    transport.destroy();
  }
  expect(clock.nextDueAt()).toBeNull();
});
