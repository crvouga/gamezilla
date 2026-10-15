import { expect, test } from 'bun:test';
import {
  prepareCustomGame,
  startCustomGame,
  startCustomGameAgainstBot,
} from '@libs/runtime-harness/custom-game-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

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
        if (
          !connected &&
          (id === 'chess-custom-create' || id === 'chess-custom-play-bot')
        )
          throw new Error('connection needed');
      },
      expect: {
        visible: async () => {},
        hidden: async () => {
          if (id !== 'chess-custom-connection-needed')
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

// regression: custom-game-journey-before-room-connected
test.each([prepareCustomGame, startCustomGameAgainstBot])(
  '%p waits for a fresh room before sending its first choice',
  async (journey) => {
    const { ui, taps } = connectingDevice();
    await journey(ui);
    expect(
      taps.includes('chess-custom-create') ||
        taps.includes('chess-custom-play-bot')
    ).toBe(true);
  }
);

test.each([prepareCustomGame, startCustomGameAgainstBot])(
  '%p fails without sending a choice when the room never connects',
  async (journey) => {
    const { ui, taps } = connectingDevice(false);
    await expect(journey(ui)).rejects.toThrow('room did not connect');
    expect(taps).not.toContain('chess-custom-create');
    expect(taps).not.toContain('chess-custom-play-bot');
  }
);

test('the offline start gesture still attempts the choice while disconnected', async () => {
  const { ui, taps } = connectingDevice(false);
  await startCustomGame(ui);
  expect(taps).toEqual(['chess-custom-start']);
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
      return id === 'chess-custom-connection-needed'
        ? { ...node, expect: { ...node.expect, visible: () => disconnected } }
        : node;
    },
  };
  const starting = startCustomGame(delayed);
  await Promise.resolve();
  expect(taps).toEqual([]);
  disconnect();
  await starting;
  expect(taps).toEqual(['chess-custom-start']);
});
