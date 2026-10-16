import { expect, test } from 'bun:test';
import { startMultiplayerSearch } from '@libs/runtime-harness/multiplayer-journey';
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
      expect: { hidden: async () => {}, text: unused, visible: async () => {} },
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
