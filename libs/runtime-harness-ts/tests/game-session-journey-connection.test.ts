import { expect, test } from 'bun:test';
import {
  prepareGameSession,
  startGameSession,
  startGameSessionAgainstBot,
} from '@libs/runtime-harness-ts/game-session-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/** The menu is usable before the fresh space's socket finishes syncing. */
function connectingDevice(available = true): {
  ui: Driver;
  taps: string[];
} {
  let connected = false;
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('unused gesture');
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id: string): DriverNode => ({
      get: unused,
      attribute: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: async () => {},
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: unused,
      text: unused,
      tap: async () => {
        taps.push(id);
        if (!connected && id === 'game-session-create')
          throw new Error('connection needed');
      },
      expect: {
        visible: async () => {},
        hidden: async () => {
          if (id !== 'game-session-connection-needed')
            throw new Error(`unexpected wait: ${id}`);
          if (!available) throw new Error('room did not connect');
          connected = true;
        },
        text: async () => {},
      },
    }),
  };
  return { ui, taps };
}

// regression: game-session-journey-before-room-connected
test.each([prepareGameSession, startGameSessionAgainstBot])(
  '%p waits for a fresh room before sending its first choice',
  async (journey) => {
    const { ui, taps } = connectingDevice();
    await journey(ui);
    expect(taps.includes('game-session-create')).toBe(true);
  }
);

test.each([prepareGameSession, startGameSessionAgainstBot])(
  '%p fails without sending a choice when the room never connects',
  async (journey) => {
    const { ui, taps } = connectingDevice(false);
    await expect(journey(ui)).rejects.toThrow('room did not connect');
    expect(taps).not.toContain('game-session-create');
  }
);

test('the offline start gesture still attempts the choice while disconnected', async () => {
  const { ui, taps } = connectingDevice(false);
  await startGameSession(ui);
  expect(taps).toEqual(['game-session-start']);
});

// regression: health-offline-existing-room-socket
test('the offline start waits for the room to observe the network cut', async () => {
  const { ui, taps } = connectingDevice(false);
  let disconnect = () => {};
  const disconnected = new Promise<void>((resolve) => {
    disconnect = resolve;
  });
  const get = ui.get.bind(ui);
  const delayed: Driver = {
    ...ui,
    get: (id) => {
      const node = get(id);
      return id === 'game-session-connection-needed'
        ? { ...node, expect: { ...node.expect, visible: () => disconnected } }
        : node;
    },
  };
  const starting = startGameSession(delayed);
  await Promise.resolve();
  expect(taps).toEqual([]);
  disconnect();
  await starting;
  expect(taps).toEqual(['game-session-start']);
});
