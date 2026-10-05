import { expect, test } from 'bun:test';
import { createInProcessRoomNode } from '@libs/spaces-harness/in-process-room-node';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';

// regression: space-canceled-open-registers-late
test('destroying a room during admission prevents a late connection', async () => {
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  let ids = 0;
  let release: (() => void) | undefined;
  const admission = new Promise<void>((resolve) => {
    release = resolve;
  });
  const node = createInProcessRoomNode(
    {
      clock,
      timers,
      seed: 1n,
      random: () => 0.5,
      createId: () => `id-${++ids}`,
    },
    {
      games: [],
      gateway: {
        roomGrants: async () => {
          await admission;
          return [];
        },
      },
    }
  );
  const transport = node.createTransport({
    topic: 'space:friday',
    module: 'space',
    identity: 'alice',
    installId: 'alice-device',
    clientId: 'alice-tab',
    apiUrl: 'https://app.example',
    getSessionToken: () => null,
    timers,
    random: () => 0.5,
  });
  try {
    const opening = transport.connect();
    transport.destroy();
    release?.();
    await opening;
    expect(transport.isConnected).toBe(false);
    expect(node.inspect('space:friday')?.roster).toEqual([]);
  } finally {
    transport.destroy();
    node.dispose();
  }
});
