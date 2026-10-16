import { expect, test } from 'bun:test';
import {
  establishMultiplayerSearch,
  expectSharedMultiplayerGame,
  startMultiplayerSearch,
} from '@libs/runtime-harness/multiplayer-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

function loadingScreen(
  invitation: boolean,
  leftover = false
): { ui: Driver; taps: string[] } {
  let ongoing = leftover;
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const ui: Driver = {
    kind: 'loading-permission',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: async () => (ongoing ? 'ongoing' : null),
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      text: unused,
      isVisible: async () =>
        id === 'multiplayer-game' ||
        (id === 'multiplayer-abort' && ongoing) ||
        id === 'multiplayer-access-denial' ||
        (id === 'multiplayer-access-denial-action' && invitation),
      tap: async () => {
        if (ongoing && id === 'multiplayer-time-control-5-0')
          throw new Error('the previous game still owns the account');
        taps.push(id);
        if (id === 'multiplayer-confirm') ongoing = false;
      },
      expect: {
        hidden: async () => {},
        text: unused,
        visible: async () => {
          if (id === 'multiplayer-waiting') taps.push('waiting-row-shown');
        },
      },
    }),
  };
  return { ui, taps };
}

test('a loading permission surface does not count as a completed search', async () => {
  // regression: multiplayer-search-transient-denial
  const { ui, taps } = loadingScreen(false);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual(['multiplayer-time-control-5-0', 'multiplayer-find']);
});

// regression: live-multiplayer-leftover-game
test('a monitor left in an unfinished game retires it before finding a new opponent', async () => {
  const { ui, taps } = loadingScreen(false, true);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([
    'multiplayer-abort',
    'multiplayer-confirm',
    'multiplayer-dismiss',
    'multiplayer-time-control-5-0',
    'multiplayer-find',
  ]);
});

test('an account invitation never starts a guest search', async () => {
  const { ui, taps } = loadingScreen(true);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([]);
});

// regression: multiplayer-given-search-not-landed
test('a pre-existing search waits for its accepted waiting row before the next person searches', async () => {
  const { ui, taps } = loadingScreen(false);
  await establishMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([
    'multiplayer-time-control-5-0',
    'multiplayer-find',
    'waiting-row-shown',
  ]);
});

// regression: multiplayer-shared-game-was-finished
test('the same completed board on both devices is not a newly matched game', async () => {
  const { ui } = loadingScreen(false);
  ui.snapshotHtml = async () =>
    '<div data-testid="multiplayer-game" data-game-id="last-match" data-outcome="white"></div>';
  const get = ui.get.bind(ui);
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      expect: {
        ...node.expect,
        visible: async () => {
          if (id === 'multiplayer-abort')
            throw new Error('there is no ongoing game');
        },
      },
    };
  };
  const act = async (_name: string, gestures: (ui: Driver) => Promise<void>) =>
    gestures(ui);
  await expect(
    expectSharedMultiplayerGame(
      { act, actAsGuest: act, now: async () => 0 },
      5000
    )
  ).rejects.toThrow('no ongoing game');
});
