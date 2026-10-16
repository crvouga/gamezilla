import { expect, test } from 'bun:test';
import { startMultiplayerSearch } from '@libs/runtime-harness/multiplayer-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

function loadingScreen(invitation: boolean): { ui: Driver; taps: string[] } {
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
      attribute: unused,
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
        id === 'multiplayer-access-denial' ||
        (id === 'multiplayer-access-denial-action' && invitation),
      tap: async () => {
        taps.push(id);
      },
      expect: { hidden: unused, text: unused, visible: async () => {} },
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

test('an account invitation never starts a guest search', async () => {
  const { ui, taps } = loadingScreen(true);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([]);
});
